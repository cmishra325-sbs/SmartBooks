import { Tenant } from "../entities/tenant";

export interface TenantRepository {
  /**
   * Save a tenant aggregate to the database.
   * Supports passing an active transaction client for atomicity.
   */
  save(tenant: Tenant, client?: any): Promise<void>;

  /**
   * Find a tenant by its unique ID.
   */
  findById(id: string): Promise<Tenant | null>;
}
