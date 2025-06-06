const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Không có Token" });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Token không đúng định dạng" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    if (!payload._id) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token: missing user ID" });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
