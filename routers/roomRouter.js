const express = require("express");
const router = express.Router();
const { getRoomsWithTypes } = require("../controller/roomController");
const {createRoom, createRoomType, getAllRoomTypeByYachtId, getAllRoomByYachtId} = require('../controller/roomController');
const {upload} = require('../utils/configClound')


router.get("/", getRoomsWithTypes);
router.post('/room/create', upload.single('avatar'), createRoom);
router.post('/roomtype/create', upload.none(), createRoomType);
router.get("/roomtype/all-by-yacht", getAllRoomTypeByYachtId);
router.get("/room/all-by-yacht", getAllRoomByYachtId);

module.exports = router;
