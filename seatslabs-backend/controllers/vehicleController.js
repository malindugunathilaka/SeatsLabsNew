const pool = require('../config/database');

const vehicleController = {
    addVehicle: async (req, res) => {
        try {
            const { brandId, modelId, bodyTypeId, registrationNumber, manufactureYear, vehicleColor, vehicleMileage } = req.body;
            // Ensure customerId is extracted correctly from the authenticated user
            // The auth middleware should populate req.user with { userId, userType } or similar and search for customerId
            // The previous code assumed req.user.customerId which might not be set if the token only has userId
            // We need to fetch customerId or rely on middleware to set it.
            // Assuming middleware does its job or we query it.
            // Let's first look at how middleware works? We don't have visibility, but let's assume req.user.id is userId.
            // But let's stick to the current pattern but fix the column names first.
            const customerId = req.user.customerId; // This might be undefined if not set
            
            // If customerId is missing, we might need to query it from Users table using req.user.userId
             if (!customerId) {
                 const customerRes = await pool.query('SELECT "customerId" FROM "Customers" WHERE "userId" = $1', [req.user.userId]);
                 if (customerRes.rows.length === 0) throw new Error('Customer profile not found');
                 req.user.customerId = customerRes.rows[0].customerId;
             }

            const result = await pool.query(
                'INSERT INTO "Vehicles" ("customerId", "vehicleBrandId", "vehicleModelId", "vehicleBodyTypeId", "vehicleRegistrationNumber", "vehicleManufactureYear", "vehicleColor", "vehicleMileage") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [req.user.customerId, brandId, modelId, bodyTypeId, registrationNumber, manufactureYear, vehicleColor, vehicleMileage]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(400).json({ error: error.message });
        }
    },

    getCustomerVehicles: async (req, res) => {
        try {
            let customerId = req.user.customerId;
             if (!customerId) {
                 const customerRes = await pool.query('SELECT "customerId" FROM "Customers" WHERE "userId" = $1', [req.user.userId]);
                 if (customerRes.rows.length > 0) customerId = customerRes.rows[0].customerId;
             }

            const result = await pool.query('SELECT v.*, vb."vehicleBrandName", vm."vehicleModelName" FROM "Vehicles" v JOIN "VehicleBrands" vb ON v."vehicleBrandId" = vb."vehicleBrandId" JOIN "VehicleModels" vm ON v."vehicleModelId" = vm."vehicleModelId" WHERE v."customerId" = $1', [customerId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    updateVehicle: async (req, res) => {
        try {
            const { vehicleId } = req.params;
            const { vehicleColor, vehicleMileage } = req.body;
            let customerId = req.user.customerId;
             if (!customerId) {
                 const customerRes = await pool.query('SELECT "customerId" FROM "Customers" WHERE "userId" = $1', [req.user.userId]);
                 if (customerRes.rows.length > 0) customerId = customerRes.rows[0].customerId;
             }
            
            await pool.query('UPDATE "Vehicles" SET "vehicleColor" = $1, "vehicleMileage" = $2, "vehicleUpdatedAt" = CURRENT_TIMESTAMP WHERE "vehicleId" = $3 AND "customerId" = $4', [vehicleColor, vehicleMileage, vehicleId, customerId]);
            res.json({ success: true, message: 'Vehicle updated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    deleteVehicle: async (req, res) => {
        try {
            const { vehicleId } = req.params;
            let customerId = req.user.customerId;
             if (!customerId) {
                 const customerRes = await pool.query('SELECT "customerId" FROM "Customers" WHERE "userId" = $1', [req.user.userId]);
                 if (customerRes.rows.length > 0) customerId = customerRes.rows[0].customerId;
             }
            await pool.query('DELETE FROM "Vehicles" WHERE "vehicleId" = $1 AND "customerId" = $2', [vehicleId, customerId]);
            res.json({ success: true, message: 'Vehicle deleted' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAllBrands: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT "vehicleBrandId" as vehicle_brand_id, 
                       "vehicleBrandName" as vehicle_brand_name,
                       "vehicleBrandCountry" as vehicle_brand_country
                FROM "VehicleBrands" 
                ORDER BY "vehicleBrandName"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllModels: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT "vehicleModelId" as vehicle_model_id, 
                       "vehicleBrandId" as vehicle_brand_id,
                       "vehicleModelName" as vehicle_model_name 
                FROM "VehicleModels" 
                ORDER BY "vehicleModelName"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getModelsByBrand: async (req, res) => {
        try {
            const { brandId } = req.params;
            const result = await pool.query(`
                SELECT "vehicleModelId" as vehicle_model_id, 
                       "vehicleBrandId" as vehicle_brand_id,
                       "vehicleModelName" as vehicle_model_name 
                FROM "VehicleModels" 
                WHERE "vehicleBrandId" = $1 
                ORDER BY "vehicleModelName"
            `, [brandId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllBodyTypes: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT "vehicleBodyTypeId" as vehicle_body_type_id, 
                       "vehicleBodyTypeName" as vehicle_body_type_name,
                       "vehicleBodyTypeDescription" as vehicle_body_type_description
                FROM "VehicleBodyTypes" 
                ORDER BY "vehicleBodyTypeName"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createBrand: async (req, res) => {
        try {
            const { name, vehicleBrandCountry } = req.body;
            const result = await pool.query('INSERT INTO "VehicleBrands" ("vehicleBrandName", "vehicleBrandCountry") VALUES ($1, $2) RETURNING *', [name, vehicleBrandCountry]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    createModel: async (req, res) => {
        try {
            const { brandId, name, year } = req.body;
            const result = await pool.query('INSERT INTO "VehicleModels" ("vehicleBrandId", "vehicleModelName", "vehicleModelYearIntroduced") VALUES ($1, $2, $3) RETURNING *', [brandId, name, year]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    createBodyType: async (req, res) => {
        try {
            const { name, vehicleDescription } = req.body;
            const result = await pool.query('INSERT INTO "VehicleBodyTypes" ("vehicleBodyTypeName", "vehicleBodyTypeDescription") VALUES ($1, $2) RETURNING *', [name, vehicleDescription]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = vehicleController;
