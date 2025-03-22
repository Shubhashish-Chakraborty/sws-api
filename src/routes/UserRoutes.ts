import { Router } from "express";
import { filter, getAllUsers, signup, verify_email } from "../controllers/UserController";

export const UserRouter = Router();

UserRouter.post("/signup" , signup);
UserRouter.post("/filter-unverified" , filter);
UserRouter.post("/verify-mail" , verify_email);
UserRouter.get("/data" , getAllUsers);