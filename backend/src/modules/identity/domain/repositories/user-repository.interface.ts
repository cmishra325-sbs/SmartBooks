import { User } from "../entities/user";

export interface UserRepository {
  /**
   * Save a user entity to the database.
   * Supports passing an active transaction client for atomicity.
   */
  save(user: User, client?: any): Promise<void>;

  /**
   * Find a user by their unique login email.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find a user by their unique ID.
   */
  findById(id: string): Promise<User | null>;
}
