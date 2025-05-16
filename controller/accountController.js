const { account } = require('../model');

const getAllAccounts = async (req, res) => {
  try {
    const accounts = await account.find();

    if (!accounts) {
      return res.status(404).json({ message: "No accounts found" });
    }
    // res.status(200).json(accounts);
    res.status(200).json({
      message: "Accounts retrieved successfully",
      data: accounts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllAccounts,
};
