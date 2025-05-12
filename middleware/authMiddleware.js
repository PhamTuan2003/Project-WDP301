const Role = require('../models/role');
require("dotenv").config();
const jwt = require("jsonwebtoken");
const checkPermission = (permissionRequired) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const role = await Role.findById(user.roleId);
      if (role.permissions.includes(permissionRequired)) {
        next();
      } else {
        return res.status(403).json({ message: 'Không có quyền thực hiện hành động này' });
      }
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi server' });
    }
  };
};

// Middleware kiểm tra JWT Token
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(403).json({ message: "Access Denied" });
  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};


module.exports = { verifyToken, checkPermission };