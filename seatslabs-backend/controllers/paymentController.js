const pool = require('../config/database');

const paymentController = {
    processBookingPayment: async (req, res) => {
        try {
            const { bookingId } = req.params;
            const { amount, paymentMethodId, transactionId } = req.body;
            const result = await pool.query(
                `INSERT INTO "Payments" ("bookingId", "paymentMethodId", "paymentAmount", "paymentStatusId", "paymentTransactionId") 
                 VALUES ($1, $2, $3, (SELECT "paymentStatusId" FROM "PaymentStatuses" WHERE "paymentStatusName" = 'Completed'), $4) RETURNING *`,
                [bookingId, paymentMethodId, amount, transactionId]
            );
            // Update booking status
            await pool.query('UPDATE "Bookings" SET "bookingStatusId" = (SELECT "bookingStatusId" FROM "BookingStatuses" WHERE "bookingStatusName" = \'Approved\') WHERE "bookingId" = $1', [bookingId]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getCustomerPayments: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT p."paymentId" as payment_id, p."paymentAmount" as amount, 
                       p."paymentDateTime" as payment_date_time, 
                       ps."paymentStatusName" as payment_status,
                       b."bookingReference" as booking_reference
                FROM "Payments" p 
                JOIN "Bookings" b ON p."bookingId" = b."bookingId" 
                JOIN "PaymentStatuses" ps ON p."paymentStatusId" = ps."paymentStatusId"
                WHERE b."customerId" = $1
            `, [req.user.customerId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    processAdPayment: async (req, res) => {
        try {
            const { campaignId } = req.params;
            const { amount, paymentMethodId, transactionId } = req.body;
            const result = await pool.query(
                "INSERT INTO \"AdPayments\" (\"adCampaignId\", \"adPaymentAmount\", \"adPaymentStatus\", \"adPaymentTransactionId\", \"adPaymentDateTime\") VALUES ($1, $2, 'Completed', $3, CURRENT_TIMESTAMP) RETURNING *",
                [campaignId, amount, transactionId]
            );
            // Update campaign status
            await pool.query('UPDATE "AdCampaigns" SET "adCampaignStatusId" = (SELECT "adCampaignStatusId" FROM "AdCampaignStatuses" WHERE "adCampaignStatusName" = \'Active\') WHERE "adCampaignId" = $1', [campaignId]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAdvertiserPayments: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT ap.*, ac."adCampaignName" 
                FROM "AdPayments" ap 
                JOIN "AdCampaigns" ac ON ap."adCampaignId" = ac."adCampaignId" 
                WHERE ac."advertiserId" = $1
            `, [req.user.advertiserId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllPayments: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT p."paymentId" as payment_id, p."paymentAmount" as amount, 
                       p."paymentDateTime" as payment_date_time,
                       ps."paymentStatusName" as payment_status,
                       b."bookingReference" as booking_reference,
                       u."userFirstName" as user_first_name, u."userLastName" as user_last_name
                FROM "Payments" p 
                JOIN "Bookings" b ON p."bookingId" = b."bookingId"
                JOIN "PaymentStatuses" ps ON p."paymentStatusId" = ps."paymentStatusId"
                JOIN "Customers" c ON b."customerId" = c."customerId"
                JOIN "Users" u ON c."userId" = u."userId"
                ORDER BY p."paymentDateTime" DESC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getPaymentMethods: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM "PaymentMethods" WHERE "paymentMethodIsActive" = true');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createPaymentMethod: async (req, res) => {
        try {
            const { name, type } = req.body;
            const result = await pool.query('INSERT INTO "PaymentMethods" ("paymentMethodName", "paymentMethodType") VALUES ($1, $2) RETURNING *', [name, type]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    verifyPayment: async (req, res) => {
        try {
            const { paymentId } = req.params;
            await pool.query('UPDATE "Payments" SET "paymentStatusId" = (SELECT "paymentStatusId" FROM "PaymentStatuses" WHERE "paymentStatusName" = \'Completed\') WHERE "paymentId" = $1', [paymentId]);
            res.json({ success: true, message: 'Payment verified' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    processRefund: async (req, res) => {
        try {
            const { paymentId } = req.params;
            await pool.query('UPDATE "Payments" SET "paymentStatusId" = (SELECT "paymentStatusId" FROM "PaymentStatuses" WHERE "paymentStatusName" = \'Refunded\') WHERE "paymentId" = $1', [paymentId]);
            res.json({ success: true, message: 'Refund processed' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = paymentController;
