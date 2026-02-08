const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const userController = {
    getProfile: async (req, res) => {
        try {
            res.json({ success: true, data: req.user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const { firstName, lastName, phoneNumber } = req.body;
            await pool.query(
                'UPDATE "Users" SET "userFirstName" = $1, "userLastName" = $2, "userPhoneNumber" = $3, "userUpdatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $4',
                [firstName, lastName, phoneNumber, req.user.userId]
            );
            res.json({ success: true, message: 'Profile updated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    changePassword: async (req, res) => {
        try {
            const { oldPassword, newPassword } = req.body;
            // Verify old password
            const userResult = await pool.query('SELECT "userPasswordHash" FROM "Users" WHERE "userId" = $1', [req.user.userId]);
            const isMatch = await bcrypt.compare(oldPassword, userResult.rows[0].userPasswordHash);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid old password' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            await pool.query('UPDATE "Users" SET "userPasswordHash" = $1, "userUpdatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $2', [hashedPassword, req.user.userId]);
            res.json({ success: true, message: 'Password changed' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    deleteAccount: async (req, res) => {
        try {
            await pool.query('UPDATE "Users" SET "userIsActive" = false WHERE "userId" = $1', [req.user.userId]);
            res.json({ success: true, message: 'Account deactivated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAllUsers: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT "userId" as user_id, "userEmail" as user_email, 
                       "userFirstName" as user_first_name, "userLastName" as user_last_name, 
                       "userIsActive" as user_is_active 
                FROM "Users"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllCustomers: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT u."userId" as user_id, u."userEmail" as user_email, 
                       u."userFirstName" as user_first_name, u."userLastName" as user_last_name,
                       c."customerId" as customer_id
                FROM "Users" u 
                JOIN "Customers" c ON u."userId" = c."userId"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllTechnicians: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT u."userId" as user_id, u."userFirstName" as user_first_name, u."userLastName" as user_last_name,
                       t."technicianId" as technician_id, t."technicianSpecialization" as specialization,
                       t."technicianSkillLevel" as skill_level, t."technicianIsAvailable" as is_available,
                       t."technicianPerformanceRating" as performance_rating
                FROM "Users" u 
                JOIN "Technicians" t ON u."userId" = t."userId"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createTechnician: async (req, res) => {
        try {
            const { firstName, lastName, email, phone, password, technicianSpecialization, skillLevel } = req.body;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const result = await pool.query(
                `WITH new_user AS (
                    INSERT INTO "Users" ("userTypeId", "userFirstName", "userLastName", "userEmail", "userPhoneNumber", "userPasswordHash")
                    VALUES ((SELECT "userTypeId" FROM "UserTypes" WHERE "userTypeName" = 'Technician'), $1, $2, $3, $4, $5)
                    RETURNING "userId"
                )
                INSERT INTO "Technicians" ("userId", "technicianSpecialization", "technicianSkillLevel")
                SELECT "userId", $6, $7 FROM new_user RETURNING *`,
                [firstName, lastName, email, phone, hashedPassword, technicianSpecialization, skillLevel]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    updateTechnician: async (req, res) => {
        try {
            const { technicianId } = req.params;
            const { technicianSpecialization, skillLevel, technicianIsAvailable } = req.body;
            await pool.query(
                'UPDATE "Technicians" SET "technicianSpecialization" = $1, "technicianSkillLevel" = $2, "technicianIsAvailable" = $3 WHERE "technicianId" = $4',
                [technicianSpecialization, skillLevel, technicianIsAvailable, technicianId]
            );
            res.json({ success: true, message: 'Technician updated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    deleteTechnician: async (req, res) => {
        try {
            const { technicianId } = req.params;
            const techResult = await pool.query('SELECT "userId" FROM "Technicians" WHERE "technicianId" = $1', [technicianId]);
            if (techResult.rows.length > 0) {
                await pool.query('UPDATE "Users" SET "userIsActive" = false WHERE "userId" = $1', [techResult.rows[0].userId]);
                res.json({ success: true, message: 'Technician deactivated' });
            } else {
                res.status(404).json({ error: 'Technician not found' });
            }
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAllAdvertisers: async (req, res) => {
        try {
            const result = await pool.query('SELECT u.*, ad."advertiserId", ad."advertiserBusinessName" FROM "Users" u JOIN "Advertisers" ad ON u."userId" = ad."userId"');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    approveAdvertiser: async (req, res) => {
        try {
            const { advertiserId } = req.params;
            await pool.query('UPDATE "Advertisers" SET "advertiserIsApproved" = true WHERE "advertiserId" = $1', [advertiserId]);
            res.json({ success: true, message: 'Advertiser approved' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    activateUser: async (req, res) => {
        try {
            const { userId } = req.params;
            await pool.query('UPDATE "Users" SET "userIsActive" = true WHERE "userId" = $1', [userId]);
            res.json({ success: true, message: 'User activated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    deactivateUser: async (req, res) => {
        try {
            const { userId } = req.params;
            await pool.query('UPDATE "Users" SET "userIsActive" = false WHERE "userId" = $1', [userId]);
            res.json({ success: true, message: 'User deactivated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = userController;
