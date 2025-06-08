const { Customer, Account } = require("../model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {
    const { username, email, fullName, phoneNumber, address, password } =
      req.body;
    if (
      !username ||
      !email ||
      !fullName ||
      !phoneNumber ||
      !address ||
      !password
    ) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    const existing = await Account.findOne({ username });
    if (existing) {
      return res.status(400).json({
        message: "Tên đăng nhập đã tồn tại, vui lòng dùng tên đăng nhập khác!",
      });
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Account
    const account = await Account.create({
      username,
      password: hashedPassword,
      roles: "CUSTOMER",
      status: 1,
    });

    // Create Customer profile
    const customer = await Customer.create({
      fullName,
      email,
      phoneNumber,
      address,
      accountId: account._id,
    });

    res.status(201).json({
      message: "Tạo tài khoản thành công",
      customer: {
        _id: account._id.toString(),
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        username: account.username,
      },
    });
  } catch (error) {
    console.error("Đăng ký bị lỗi:", error);
    res.status(500).json({ message: "Lỗi server khi đăng ký, thử lại sau" });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Hãy điền tên đăng nhập và mật khẩu" });
    }

    const account = await Account.findOne({ username });
    if (!account) {
      return res
        .status(400)
        .json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    const customer = await Customer.findOne({ accountId: account._id });
    if (!customer) {
      return res
        .status(400)
        .json({ message: "Không tìm thấy thông tin khách hàng" });
    }

    const token = jwt.sign(
      { _id: account._id, role: account.roles, customerId: customer._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      customer: {
        accountId: account._id.toString(),
        id: customer._id.toString(),
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        username: account.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi server khi đăng nhập" });
  }
};

module.exports = { register, login };
