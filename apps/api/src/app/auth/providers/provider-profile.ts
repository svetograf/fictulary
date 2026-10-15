import { AuthProvider } from '@fictulary/shared/models';

/** Who a verified provider ID token belongs to. */
export interface ProviderProfile {
  provider: AuthProvider;
  /** The provider's stable user id. */
  subject: string;
  /** Lowercased. */
  email: string;
  emailVerified: boolean;
  name: string | null;
}
