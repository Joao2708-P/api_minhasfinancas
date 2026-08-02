import { Hono } from "hono";
import { userController } from "../controllers/user.controller";
import type { AppEnv } from "../types";

export const userRoute = new Hono<AppEnv>();

// Operações sobre o próprio usuário (o id vem do token).
userRoute.get('/me', userController.getMe);
userRoute.put('/me', userController.updateMe);
userRoute.delete('/me', userController.deleteMe);
