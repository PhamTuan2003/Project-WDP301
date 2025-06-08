const express = require("express");
const router = express.Router();
const { getRoomsWithTypes } = require("../controller/roomController");
const {createRoom, createRoomType} = require('../controller/roomController');
const {upload} = require('../utils/configClound')


router.get("/", getRoomsWithTypes);
router.post('/room/create', upload.single('avatar'), createRoom);
router.post('/roomtype/create', createRoomType);

module.exports = router;
