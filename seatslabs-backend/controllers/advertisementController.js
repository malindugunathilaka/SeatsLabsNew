const pool = require('../config/database');

const advertisementController = {
    createCampaign: async (req, res) => {
        try {
            const { pricingPlanId, campaignName, campaignType, startDate, endDate, adCampaignBudget, targetAudience } = req.body;
            const result = await pool.query(
                `INSERT INTO "AdCampaigns" 
                ("advertiserId", "adPricingPlanId", "adCampaignStatusId", "adCampaignName", "adCampaignType", "adCampaignStartDate", "adCampaignEndDate", "adCampaignBudget", "adCampaignTargetAudience") 
                VALUES ($1, $2, (SELECT "adCampaignStatusId" FROM "AdCampaignStatuses" WHERE "adCampaignStatusName" = 'Pending Approval'), $3, $4, $5, $6, $7, $8) 
                RETURNING *`,
                [req.user.advertiserId, pricingPlanId, campaignName, campaignType, startDate, endDate, adCampaignBudget, targetAudience]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAdvertiserCampaigns: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM "AdCampaigns" WHERE "advertiserId" = $1', [req.user.advertiserId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createAdvertisement: async (req, res) => {
        try {
            const { campaignId } = req.params;
            const { adTitle, adContent, mediaType, targetServiceType } = req.body;
            const mediaUrl = req.file ? req.file.path : null;
            const result = await pool.query(
                'INSERT INTO "Advertisements" ("adCampaignId", "advertisementTitle", "advertisementContent", "advertisementMediaType", "advertisementMediaUrl") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [campaignId, adTitle, adContent, mediaType, mediaUrl]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getCampaignAnalytics: async (req, res) => {
        try {
            const { campaignId } = req.params;
            const result = await pool.query(`
                SELECT a."advertisementId", a."advertisementTitle", 
                       COALESCE(SUM(an."adAnalyticsImpressions"), 0) as total_impressions, 
                       COALESCE(SUM(an."adAnalyticsClicks"), 0) as total_clicks
                FROM "Advertisements" a
                LEFT JOIN "AdAnalytics" an ON a."advertisementId" = an."advertisementId"
                WHERE a."adCampaignId" = $1
                GROUP BY a."advertisementId", a."advertisementTitle"
            `, [campaignId]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    pauseCampaign: async (req, res) => {
        try {
            const { campaignId } = req.params;
            await pool.query("UPDATE \"AdCampaigns\" SET \"adCampaignStatusId\" = (SELECT \"adCampaignStatusId\" FROM \"AdCampaignStatuses\" WHERE \"adCampaignStatusName\" = 'Paused') WHERE \"adCampaignId\" = $1 AND \"advertiserId\" = $2", [campaignId, req.user.advertiserId]);
            res.json({ success: true, message: 'Campaign paused' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    resumeCampaign: async (req, res) => {
        try {
            const { campaignId } = req.params;
            await pool.query("UPDATE \"AdCampaigns\" SET \"adCampaignStatusId\" = (SELECT \"adCampaignStatusId\" FROM \"AdCampaignStatuses\" WHERE \"adCampaignStatusName\" = 'Active') WHERE \"adCampaignId\" = $1 AND \"advertiserId\" = $2", [campaignId, req.user.advertiserId]);
            res.json({ success: true, message: 'Campaign resumed' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getAllCampaigns: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT ac."adCampaignId" as campaign_id, ac."adCampaignName" as campaign_name, 
                       ac."adCampaignType" as campaign_type, ac."adCampaignStartDate" as start_date, 
                       ac."adCampaignEndDate" as end_date, ac."adCampaignBudget" as budget,
                       ad."advertiserBusinessName" as business_name,
                       acs."adCampaignStatusName" as status
                FROM "AdCampaigns" ac
                JOIN "Advertisers" ad ON ac."advertiserId" = ad."advertiserId"
                JOIN "AdCampaignStatuses" acs ON ac."adCampaignStatusId" = acs."adCampaignStatusId"
                ORDER BY ac."adCampaignCreatedAt" DESC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getAllAdvertisements: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT a."advertisementId" as advertisement_id, a."advertisementTitle" as ad_title, 
                       a."advertisementContent" as ad_content, a."advertisementIsApproved" as is_approved,
                       ac."adCampaignName" as campaign_name, ad."advertiserBusinessName" as business_name
                FROM "Advertisements" a
                JOIN "AdCampaigns" ac ON a."adCampaignId" = ac."adCampaignId"
                JOIN "Advertisers" ad ON ac."advertiserId" = ad."advertiserId"
                ORDER BY a."advertisementCreatedAt" DESC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    approveAdvertisement: async (req, res) => {
        try {
            const { adId } = req.params;
            await pool.query('UPDATE "Advertisements" SET "advertisementIsApproved" = true, "advertisementApprovedAt" = CURRENT_TIMESTAMP, "advertisementApprovedBy" = $1 WHERE "advertisementId" = $2', [req.user.managerId, adId]);
            res.json({ success: true, message: 'Advertisement approved' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    rejectAdvertisement: async (req, res) => {
        try {
            const { adId } = req.params;
            await pool.query('UPDATE "Advertisements" SET "advertisementIsApproved" = false WHERE "advertisementId" = $1', [adId]);
            res.json({ success: true, message: 'Advertisement rejected' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getPricingPlans: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM "AdPricingPlans" WHERE "adPricingPlanIsActive" = true');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createPricingPlan: async (req, res) => {
        try {
            const { name, type, pricePerDay, maxImpressions, adPricingPlanFeatures } = req.body;
            const result = await pool.query(
                'INSERT INTO "AdPricingPlans" ("adPricingPlanName", "adPricingPlanType", "adPricingPlanPricePerDay", "adPricingPlanMaxImpressions", "adPricingPlanFeatures") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [name, type, pricePerDay, maxImpressions, adPricingPlanFeatures]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    getActiveAdvertisements: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM "Advertisements" WHERE "advertisementIsApproved" = true');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    trackImpression: async (req, res) => {
        try {
            const { adId } = req.params;
            await pool.query(`
                INSERT INTO "AdAnalytics" ("advertisementId", "adAnalyticsDate", "adAnalyticsImpressions")
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT ("advertisementId", "adAnalyticsDate")
                DO UPDATE SET "adAnalyticsImpressions" = "AdAnalytics"."adAnalyticsImpressions" + 1
            `, [adId]);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    trackClick: async (req, res) => {
        try {
            const { adId } = req.params;
            await pool.query(`
                INSERT INTO "AdAnalytics" ("advertisementId", "adAnalyticsDate", "adAnalyticsClicks")
                VALUES ($1, CURRENT_DATE, 1)
                ON CONFLICT ("advertisementId", "adAnalyticsDate")
                DO UPDATE SET "adAnalyticsClicks" = "AdAnalytics"."adAnalyticsClicks" + 1
            `, [adId]);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = advertisementController;
