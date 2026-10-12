const express = require('express');
const router = express.Router();

const bedController = require('../controllers/bedController');

router.get("/room-type", bedController.getRoomType);
router.post("/room-type", bedController.createRoomType);
router.post("/room-type/:id", bedController.editRoomType);
router.get("/room-type/:id/delete", bedController.deleteRoomType);
router.get("/floors", bedController.getFloors);
router.post("/floors", bedController.createFloor);
router.post("/floors/:id", bedController.editFloor);
router.get("/floors/:id/delete", bedController.deleteFloor);
router.get("/rooms", bedController.getRooms);
router.post("/rooms", bedController.createRoom);
router.post("/rooms/:id", bedController.editRoom);
router.get("/rooms/:id/delete", bedController.deleteRoom);
router.get("/beds", bedController.getBeds);
router.post("/beds", bedController.createBed);
router.post("/beds/:id", bedController.editBed);
router.get("/beds/:id/delete", bedController.deleteBed);


module.exports = router;

