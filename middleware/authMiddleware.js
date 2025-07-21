const jwt = require("jsonwebtoken");
const Customer = require("../model/customer");
const Company = require("../model/company");

const veryfiToken = async (req, res, next) => {
  // Log header để kiểm tra token có về BE không
  console.log("Authorization header:", req.headers.authorization);
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Không có Token" });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Token không đúng định dạng" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    if (payload.role === "CUSTOMER") {
      const customer = await Customer.findOne({ accountId: payload._id });
      if (!customer) {
        return res.status(401).json({
          success: false,
          message: "Customer not found for this account",
        });
      }
      req.user.customerId = customer._id.toString();
      req.customer = customer;
    } else if (payload.role === "COMPANY") {
      const company = await Company.findOne({ accountId: payload._id });
      if (!company) {
        return res.status(401).json({
          success: false,
          message: "Company not found for this account",
        });
      }
      req.user.companyId = company._id.toString();
      req.company = company;
    }
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ" });
  }
};
// const adminProtect = (req, res, next) => {
//   if (req.user && req.user.role === "admin") {
//     // Assuming 'role' field in UserAccount model
//     next();
//   } else {
//     res
//       .status(403)
//       .json({ success: false, message: "Not authorized as an admin" });
//   }
// };
module.exports = {
  veryfiToken,
  // adminProtect,
};
