const Customer = require("../model/customer"); // Đúng đường dẫn

exports.getDashboardStats = async (req, res) => {
    try {
        const customerCount = await Customer.countDocuments(); // Đếm tất cả customer
        res.json({
            customer: customerCount,
            earnings: 30200,
            customer1: 245
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};