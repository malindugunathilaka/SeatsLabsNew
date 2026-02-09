const pool = require('../config/database');
const { generateBookingReference } = require('../utils/helpers');

const bookingController = {
    // Create new booking
    createBooking: async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const {
                vehicleId,
                serviceId,
                timeSlotId,
                specialNotes
            } = req.body;

            const customerId = req.user.customerId;

            // Check time slot availability
            const slotCheck = await client.query(
                'SELECT * FROM "TimeSlots" WHERE "timeSlotId" = $1 AND "timeSlotIsAvailable" = true',
                [timeSlotId]
            );

            if (slotCheck.rows.length === 0) {
                throw new Error('Time slot not available');
            }

            const slot = slotCheck.rows[0];
            if (slot.timeSlotCurrentBookings >= slot.timeSlotMaxCapacity) {
                throw new Error('Time slot is fully booked');
            }

            // Get service details for pricing
            const serviceResult = await client.query(
                'SELECT * FROM "Services" WHERE "serviceId" = $1',
                [serviceId]
            );
            const service = serviceResult.rows[0];

            // Generate booking reference
            const bookingReference = generateBookingReference();

            // Create booking
            const scheduledDateTime = new Date(
                `${slot.timeSlotDate.toISOString().split('T')[0]}T${slot.timeSlotStartTime}`
            );

            // Resolve 'Pending' status ID
            const statusResult = await client.query('SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = \'Pending\'');
            const pendingStatusId = statusResult.rows[0].bookingStatusId;

            const bookingResult = await client.query(
                `INSERT INTO "Bookings" 
        ("customerId", "vehicleId", "serviceId", "timeSlotId", "bookingReference", 
         "bookingScheduledDateTime", "bookingStatusId", "bookingSpecialNotes", "bookingEstimatedPrice")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
                [
                    customerId,
                    vehicleId,
                    serviceId,
                    timeSlotId,
                    bookingReference,
                    scheduledDateTime,
                    pendingStatusId,
                    specialNotes,
                    service.serviceBasePrice
                ]
            );

            const booking = bookingResult.rows[0];

            // Update time slot
            await client.query(
                'UPDATE "TimeSlots" SET "timeSlotCurrentBookings" = "timeSlotCurrentBookings" + 1 WHERE "timeSlotId" = $1',
                [timeSlotId]
            );

            // Create initial status history
            await client.query(
                `INSERT INTO "BookingStatusHistory" ("bookingId", "bookingStatusId", "userId", "bookingStatusHistoryNotes")
         VALUES ($1, $2, $3, $4)`,
                [booking.bookingId, pendingStatusId, req.user.userId, 'Booking created']
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Booking created successfully',
                data: booking
            });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    },

    // Get all Bookings for customer
    getCustomerBookings: async (req, res) => {
        try {
            const customerId = req.user.customerId;
            const { status, limit = 50, offset = 0 } = req.query;

            let query = `
        SELECT b."bookingId" as booking_id, b."bookingReference" as booking_reference,
               b."bookingScheduledDateTime" as scheduled_date_time,
               b."bookingSpecialNotes" as special_notes,
               b."bookingEstimatedPrice" as estimated_price,
               s."serviceName" as service_name, s."serviceDurationMinutes" as duration_minutes,
               v."vehicleRegistrationNumber" as registration_number,
               bs."bookingStatusName" as booking_status, bs."bookingStatusColor" as status_color,
               u."userFirstName" as tech_first_name, u."userLastName" as tech_last_name
        FROM "Bookings" b
        JOIN "Services" s ON b."serviceId" = s."serviceId"
        JOIN "Vehicles" v ON b."vehicleId" = v."vehicleId"
        JOIN "BookingStatuses" bs ON b."bookingStatusId" = bs."bookingStatusId"
        LEFT JOIN "Technicians" t ON b."technicianId" = t."technicianId"
        LEFT JOIN "Users" u ON t."userId" = u."userId"
        WHERE b."customerId" = $1
      `;

            const params = [customerId];

            if (status) {
                query += ' AND bs."bookingStatusName" = $2';
                params.push(status);
            }

            query += ' ORDER BY b."bookingScheduledDateTime" DESC LIMIT $' +
                (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);

            const result = await pool.query(query, params);

            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Update booking status (Manager/Technician)
    updateBookingStatus: async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { bookingId } = req.params;
            const { status, bookingStatusNotes } = req.body;

            // Resolve status ID
            const statusResult = await client.query('SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = $1', [status]);
            if (statusResult.rows.length === 0) throw new Error('Invalid status name');
            const statusId = statusResult.rows[0].bookingStatusId;

            // Update booking status
            await client.query(
                'UPDATE "Bookings" SET "bookingStatusId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP WHERE "bookingId" = $2',
                [statusId, bookingId]
            );

            // Add status history
            await client.query(
                `INSERT INTO "BookingStatusHistory" ("bookingId", "bookingStatusId", "userId", "bookingStatusHistoryNotes")
         VALUES ($1, $2, $3, $4)`,
                [bookingId, statusId, req.user.userId, bookingStatusNotes]
            );

            // If status is "In Progress", set actual start time
            if (status === 'In Progress') {
                await client.query(
                    'UPDATE "Bookings" SET "bookingActualStartTime" = CURRENT_TIMESTAMP WHERE "bookingId" = $1',
                    [bookingId]
                );
            }

            // If status is "Completed", set actual end time
            if (status === 'Completed') {
                await client.query(
                    'UPDATE "Bookings" SET "bookingActualEndTime" = CURRENT_TIMESTAMP WHERE "bookingId" = $1',
                    [bookingId]
                );
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Booking status updated successfully'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    },

    // Assign technician to booking (Manager)
    assignTechnician: async (req, res) => {
        try {
            const { bookingId } = req.params;
            const { technicianId } = req.body;

            // Check if technician is available
            const techCheck = await pool.query(
                'SELECT * FROM "Technicians" WHERE "technicianId" = $1 AND "technicianIsAvailable" = true',
                [technicianId]
            );

            if (techCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Technician not available' });
            }

            await pool.query(
                'UPDATE "Bookings" SET "technicianId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP WHERE "bookingId" = $2',
                [technicianId, bookingId]
            );

            res.json({
                success: true,
                message: 'Technician assigned successfully'
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    // Cancel booking
    cancelBooking: async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { bookingId } = req.params;
            const customerId = req.user.customerId;

            // Resolve 'Cancelled' status ID
            const statusResult = await client.query('SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = \'Cancelled\'');
            const cancelledStatusId = statusResult.rows[0].bookingStatusId;

            await client.query(
                `UPDATE "Bookings" SET "bookingStatusId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP 
                 WHERE "bookingId" = $2 AND "customerId" = $3`,
                [cancelledStatusId, bookingId, customerId]
            );

            // Add to history
            await client.query(
                `INSERT INTO "BookingStatusHistory" ("bookingId", "bookingStatusId", "userId", "bookingStatusHistoryNotes")
                 VALUES ($1, $2, $3, $4)`,
                [bookingId, cancelledStatusId, req.user.userId, 'Cancelled by customer']
            );

            await client.query('COMMIT');
            res.json({ success: true, message: 'Booking cancelled successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    },

    // Reschedule booking
    rescheduleBooking: async (req, res) => {
        try {
            const { bookingId } = req.params;
            const { timeSlotId } = req.body;
            const customerId = req.user.customerId;

            // Simple update for now
            await pool.query(
                `UPDATE "Bookings" SET "timeSlotId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP 
                 WHERE "bookingId" = $2 AND "customerId" = $3`,
                [timeSlotId, bookingId, customerId]
            );

            res.json({ success: true, message: 'Booking rescheduled successfully' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    // Get all Bookings (Manager)
    getAllBookings: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT b."bookingId" as booking_id, b."bookingReference" as booking_reference,
                       b."bookingScheduledDateTime" as scheduled_date_time,
                       b."technicianId" as technician_id,
                       u."userFirstName" as customer_first_name, u."userLastName" as customer_last_name,
                       s."serviceName" as service_name, v."vehicleRegistrationNumber" as registration_number,
                       bs."bookingStatusName" as booking_status,
                       tu."userFirstName" as tech_first_name, tu."userLastName" as tech_last_name
                FROM "Bookings" b
                LEFT JOIN "Customers" c ON b."customerId" = c."customerId"
                LEFT JOIN "Users" u ON c."userId" = u."userId"
                LEFT JOIN "Services" s ON b."serviceId" = s."serviceId"
                LEFT JOIN "Vehicles" v ON b."vehicleId" = v."vehicleId"
                LEFT JOIN "BookingStatuses" bs ON b."bookingStatusId" = bs."bookingStatusId"
                LEFT JOIN "Technicians" t ON b."technicianId" = t."technicianId"
                LEFT JOIN "Users" tu ON t."userId" = tu."userId"
                ORDER BY b."bookingScheduledDateTime" DESC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get booking by ID
    getBookingById: async (req, res) => {
        try {
            const { bookingId } = req.params;
            const result = await pool.query('SELECT * FROM "Bookings" WHERE "bookingId" = $1', [bookingId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Approve booking
    approveBooking: async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { bookingId } = req.params;

            const statusResult = await client.query('SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = \'Approved\'');
            const approvedStatusId = statusResult.rows[0].bookingStatusId;

            await client.query(
                `UPDATE "Bookings" SET "bookingStatusId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP WHERE "bookingId" = $2`,
                [approvedStatusId, bookingId]
            );

            await client.query(
                `INSERT INTO "BookingStatusHistory" ("bookingId", "bookingStatusId", "userId", "bookingStatusHistoryNotes")
                 VALUES ($1, $2, $3, $4)`,
                [bookingId, approvedStatusId, req.user.userId, 'Approved by manager']
            );

            await client.query('COMMIT');
            res.json({ success: true, message: 'Booking approved' });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    },

    // Reject booking
    rejectBooking: async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { bookingId } = req.params;

            const statusResult = await client.query('SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = \'Rejected\'');
            const rejectedStatusId = statusResult.rows[0].bookingStatusId;

            await client.query(
                `UPDATE "Bookings" SET "bookingStatusId" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP WHERE "bookingId" = $2`,
                [rejectedStatusId, bookingId]
            );

            await client.query(
                `INSERT INTO "BookingStatusHistory" ("bookingId", "bookingStatusId", "userId", "bookingStatusHistoryNotes")
                 VALUES ($1, $2, $3, $4)`,
                [bookingId, rejectedStatusId, req.user.userId, 'Rejected by manager']
            );

            await client.query('COMMIT');
            res.json({ success: true, message: 'Booking rejected' });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    },

    // Get technician jobs
    getTechnicianJobs: async (req, res) => {
        try {
            const technicianId = req.user.technicianId;
            const result = await pool.query(
                `SELECT b."bookingId" as booking_id, b."bookingReference" as booking_reference,
                        b."bookingScheduledDateTime" as scheduled_date_time,
                        s."serviceName" as service_name, v."vehicleRegistrationNumber" as registration_number,
                        bs."bookingStatusName" as booking_status
                 FROM "Bookings" b
                 JOIN "Services" s ON b."serviceId" = s."serviceId"
                 JOIN "Vehicles" v ON b."vehicleId" = v."vehicleId"
                 JOIN "BookingStatuses" bs ON b."bookingStatusId" = bs."bookingStatusId"
                 WHERE b."technicianId" = $1 
                 ORDER BY b."bookingScheduledDateTime" ASC`,
                [technicianId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Add service bookingStatuseNotes
    addServiceNotes: async (req, res) => {
        try {
            const { bookingId } = req.params;
            const { bookingStatusNotes } = req.body;
            await pool.query(
                'UPDATE "Bookings" SET "bookingSpecialNotes" = $1, "bookingUpdatedAt" = CURRENT_TIMESTAMP WHERE "bookingId" = $2',
                [bookingStatusNotes, bookingId]
            );
            res.json({ success: true, message: 'Service bookingStatuseNotes added' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    // Get available slots for a date
    // Get available slots for a date
    getAvailableSlots: async (req, res) => {
        try {
            const { date } = req.query;
            const result = await pool.query(
                `SELECT "timeSlotId" as time_slot_id,
                        "timeSlotDate" as time_slot_date,
                        "timeSlotStartTime" as time_slot_start_time,
                        "timeSlotEndTime" as time_slot_end_time
                 FROM "TimeSlots" 
                 WHERE DATE("timeSlotDate") = DATE($1) 
                 AND "timeSlotIsAvailable" = true 
                 AND "timeSlotCurrentBookings" < "timeSlotMaxCapacity"
                 ORDER BY "timeSlotStartTime"`,
                [date]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = bookingController;