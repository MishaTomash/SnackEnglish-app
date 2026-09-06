import { Router } from "express";
import {
  getProfile,
  toggleLike,
  sendFriendRequest,
  respondFriendRequest,
  getMyFriends,
  getMyProfileStats,
} from "../controllers/profileController.js";

const router = Router();

router.get("/me/friends", getMyFriends);
router.get("/me/stats", getMyProfileStats);
router.get("/:userId", getProfile);
router.post("/:userId/like", toggleLike);
router.post("/:userId/friend-request", sendFriendRequest);
router.post("/:userId/friend-respond", respondFriendRequest);

export default router;
