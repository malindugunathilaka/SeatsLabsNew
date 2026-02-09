const pool = require('../config/database');

const serviceController = {
    getAllServices: async (req, res) => {
        try {
            const { categoryId, available } = req.query;

            let query = `
        SELECT s."serviceId" as service_id, s."serviceName" as service_name, 
               s."serviceDescription" as service_description,
               s."serviceDurationMinutes" as duration_minutes, 
               s."serviceBasePrice" as base_price,
               s."serviceCategoryId" as service_category_id,
               sc."serviceCategoryName" as service_category_name 
        FROM "Services" s
        LEFT JOIN "ServiceCategories" sc ON s."serviceCategoryId" = sc."serviceCategoryId"
        WHERE 1=1
      `;
            const params = [];

            if (categoryId) {
                params.push(categoryId);
                query += ` AND s."serviceCategoryId" = $${params.length}`;
            }

            if (available === 'true') {
                query += ' AND s."serviceIsActive" = true';
            }

            query += ' ORDER BY s."serviceName"';

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

    createService: async (req, res) => {
        try {
            const {
                serviceCategoryId,
                serviceName,
                serviceDescription,
                durationMinutes,
                basePrice,
                serviceRequirements
            } = req.body;

            const result = await pool.query(
                `INSERT INTO "Services" 
        ("serviceCategoryId", "serviceName", "serviceDescription", 
         "serviceDurationMinutes", "serviceBasePrice", "serviceRequirements")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
                [parseInt(serviceCategoryId), serviceName, serviceDescription,
                    durationMinutes, basePrice, serviceRequirements]
            );

            res.status(201).json({
                success: true,
                message: 'Service created successfully',
                data: result.rows[0]
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    updateServicePrice: async (req, res) => {
        try {
            const { serviceId } = req.params;
            const { basePrice } = req.body;

            await pool.query(
                'UPDATE "Services" SET "serviceBasePrice" = $1, "serviceUpdatedAt" = CURRENT_TIMESTAMP WHERE "serviceId" = $2',
                [basePrice, serviceId]
            );

            res.json({
                success: true,
                message: 'Service price updated successfully'
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    updateServiceDuration: async (req, res) => {
        try {
            const { serviceId } = req.params;
            const { durationMinutes } = req.body;

            await pool.query(
                'UPDATE "Services" SET "serviceDurationMinutes" = $1, "serviceUpdatedAt" = CURRENT_TIMESTAMP WHERE "serviceId" = $2',
                [durationMinutes, serviceId]
            );

            res.json({
                success: true,
                message: 'Service duration updated successfully'
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAllCategories: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT "serviceCategoryId" as service_category_id, 
                       "serviceCategoryName" as service_category_name,
                       "serviceCategoryDescription" as service_category_description
                FROM "ServiceCategories" 
                ORDER BY "serviceCategoryName"
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getServiceById: async (req, res) => {
        try {
            const { serviceId } = req.params;
            const result = await pool.query('SELECT * FROM "Services" WHERE "serviceId" = $1', [serviceId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Service not found' });
            }
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createCategory: async (req, res) => {
        try {
            const { name, serviceDescription } = req.body;
            const result = await pool.query(
                'INSERT INTO "ServiceCategories" ("serviceCategoryName", "serviceCategoryDescription") VALUES ($1, $2) RETURNING *',
                [name, serviceDescription]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    updateService: async (req, res) => {
        try {
            const { serviceId } = req.params;
            const { name, serviceDescription, duration, price } = req.body;
            await pool.query(
                'UPDATE "Services" SET "serviceName" = $1, "serviceDescription" = $2, "serviceDurationMinutes" = $3, "serviceBasePrice" = $4, "serviceUpdatedAt" = CURRENT_TIMESTAMP WHERE "serviceId" = $5',
                [name, serviceDescription, duration, price, serviceId]
            );
            res.json({ success: true, message: 'Service updated' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    deleteService: async (req, res) => {
        try {
            const { serviceId } = req.params;
            await pool.query('DELETE FROM "Services" WHERE "serviceId" = $1', [serviceId]);
            res.json({ success: true, message: 'Service deleted' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = serviceController;