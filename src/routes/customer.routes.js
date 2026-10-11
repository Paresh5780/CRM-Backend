import { Router } from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} from "../controllers/customer.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomersQuerySchema
} from "../validators/customer.validator.js";

const router = Router();

router.use(authenticate);

router.post("/", validate({ body: createCustomerSchema }), createCustomer);
router.get("/", validate({ query: getCustomersQuerySchema }), getCustomers);
router.get("/:id", getCustomerById);
router.put("/:id", validate({ body: updateCustomerSchema }), updateCustomer);
router.patch("/:id", validate({ body: updateCustomerSchema }), updateCustomer);
router.delete("/:id", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), deleteCustomer);

export default router;
