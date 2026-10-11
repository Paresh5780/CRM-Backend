import { User } from "../models/user.model.js";
import { ROLES } from "../utils/usedConstants.js";

export async function seedAdmin() {
  try {
    let admin = await User.findOne({ email: "admin@crm.com" });
    if (!admin) {
      await User.create({
        name: "System Administrator",
        email: "admin@crm.com",
        password: "AdminPassword123!",
        phone: "+1234567890",
        role: ROLES.ADMIN,
        isActive: true
      });
      console.info("Default Admin account seeded: admin@crm.com / AdminPassword123!");
    } else if (admin.role !== ROLES.ADMIN) {
      admin.role = ROLES.ADMIN;
      await admin.save();
      console.info("Updated existing Admin account to numeric role ROLES.ADMIN (1)");
    }
  } catch (error) {
    console.warn("Could not seed default admin:", error.message);
  }
}
