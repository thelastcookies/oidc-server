import Router from '@koa/router';
import { authController } from '../controller';
import authMiddleware from '../middleware/auth.ts';

const router = new Router({
  prefix: '/auth',
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/refresh', authController.refresh);

export default router;
