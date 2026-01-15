/**
 * LinkedIn OAuth Service
 * Handles LinkedIn authentication and profile data fetching
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  LinkedInTokenResponse,
  LinkedInBasicProfile,
  LinkedInEmailAddress,
  LinkedInFullProfile,
  LinkedInProfile,
  LinkedInImportResult,
  LinkedInOAuthConfig,
} from '@/types/linkedin';

// Ensure browser session is handled properly
WebBrowser.maybeCompleteAuthSession();

// LinkedIn OAuth 2.0 Endpoints
const LINKEDIN_AUTH_ENDPOINT = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_ENDPOINT = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

// LinkedIn API Endpoints
const ENDPOINTS = {
  BASIC_PROFILE: '/me',
  EMAIL: '/emailAddress?q=members&projection=(elements*(handle~))',
  // Full profile endpoints (requires r_fullprofile - LinkedIn partnership)
  POSITIONS: '/positions',
  EDUCATION: '/educations',
  SKILLS: '/skills',
  CERTIFICATIONS: '/certifications',
  LANGUAGES: '/languages',
};

// Default OAuth scopes (basic profile)
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

// Extended scopes (requires LinkedIn partnership approval)
const EXTENDED_SCOPES = ['r_fullprofile', 'r_emailaddress'];

/**
 * LinkedIn OAuth Service class
 */
class LinkedInService {
  private config: LinkedInOAuthConfig;
  private discovery: AuthSession.DiscoveryDocument;

  constructor() {
    this.config = {
      clientId: process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_SECRET,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'freeresumeai',
        path: 'linkedin-callback',
      }),
      scopes: DEFAULT_SCOPES,
    };

    this.discovery = {
      authorizationEndpoint: LINKEDIN_AUTH_ENDPOINT,
      tokenEndpoint: LINKEDIN_TOKEN_ENDPOINT,
    };
  }

  /**
   * Get the OAuth configuration
   */
  getConfig(): LinkedInOAuthConfig {
    return { ...this.config };
  }

  /**
   * Get the discovery document for expo-auth-session
   */
  getDiscovery(): AuthSession.DiscoveryDocument {
    return this.discovery;
  }

  /**
   * Get the redirect URI
   */
  getRedirectUri(): string {
    return this.config.redirectUri;
  }

  /**
   * Create an auth request for expo-auth-session
   */
  createAuthRequest(scopes?: string[]): AuthSession.AuthRequest {
    const requestScopes = scopes || this.config.scopes;

    return new AuthSession.AuthRequest({
      clientId: this.config.clientId,
      scopes: requestScopes,
      redirectUri: this.config.redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });
  }

  /**
   * Get the authorization URL for the OAuth flow
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      ...(state && { state }),
    });

    return `${LINKEDIN_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<LinkedInTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        ...(this.config.clientSecret && {
          client_secret: this.config.clientSecret,
        }),
        ...(codeVerifier && { code_verifier: codeVerifier }),
      });

      const response = await fetch(LINKEDIN_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error_description || 'Failed to exchange code for token'
        );
      }

      const tokenData: LinkedInTokenResponse = await response.json();
      return tokenData;
    } catch (error) {
      console.error('[LinkedIn] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Fetch basic profile data from LinkedIn API
   */
  async fetchBasicProfile(accessToken: string): Promise<LinkedInBasicProfile> {
    try {
      const response = await fetch(`${LINKEDIN_API_BASE}${ENDPOINTS.BASIC_PROFILE}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch basic profile');
      }

      return await response.json();
    } catch (error) {
      console.error('[LinkedIn] Fetch basic profile error:', error);
      throw error;
    }
  }

  /**
   * Fetch email address from LinkedIn API
   */
  async fetchEmailAddress(accessToken: string): Promise<string> {
    try {
      const response = await fetch(`${LINKEDIN_API_BASE}${ENDPOINTS.EMAIL}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        // Email might not be available, return empty string
        console.warn('[LinkedIn] Could not fetch email address');
        return '';
      }

      const data: LinkedInEmailAddress = await response.json();
      const primaryEmail = data.elements?.find((e) => e.primary) || data.elements?.[0];
      return primaryEmail?.['handle~']?.emailAddress || '';
    } catch (error) {
      console.error('[LinkedIn] Fetch email error:', error);
      return '';
    }
  }

  /**
   * Fetch profile picture URL from basic profile data
   */
  getProfilePictureUrl(profile: LinkedInBasicProfile): string | undefined {
    if (!profile.profilePicture?.displayImage) {
      return undefined;
    }

    // The displayImage contains a reference to the image
    // For lite profile, we need to construct the URL differently
    const pictureData = profile.profilePicture;

    if (pictureData.identifiers && pictureData.identifiers.length > 0) {
      // Get the highest resolution image
      const bestImage = pictureData.identifiers.reduce((best, current) => {
        // Prefer the image with the largest resolution
        return current.identifier || best;
      }, pictureData.identifiers[0].identifier);

      return bestImage;
    }

    return pictureData.displayImage;
  }

  /**
   * Fetch complete profile data (combines all available data)
   * Note: Full profile data requires LinkedIn partnership and r_fullprofile scope
   */
  async fetchProfile(accessToken: string): Promise<LinkedInProfile> {
    try {
      // Fetch basic profile and email in parallel
      const [basicProfile, email] = await Promise.all([
        this.fetchBasicProfile(accessToken),
        this.fetchEmailAddress(accessToken),
      ]);

      // Construct normalized profile from basic data
      const profile: LinkedInProfile = {
        id: basicProfile.id,
        firstName: basicProfile.localizedFirstName,
        lastName: basicProfile.localizedLastName,
        fullName: `${basicProfile.localizedFirstName} ${basicProfile.localizedLastName}`,
        email,
        profilePictureUrl: this.getProfilePictureUrl(basicProfile),
        vanityName: basicProfile.vanityName,
        linkedInUrl: basicProfile.vanityName
          ? `https://linkedin.com/in/${basicProfile.vanityName}`
          : undefined,
        // These fields require additional scopes (r_fullprofile)
        positions: [],
        educationEntries: [],
        skills: [],
        certifications: [],
        languages: [],
      };

      // Try to fetch extended profile data if available
      // This will only work with LinkedIn partnership access
      try {
        await this.fetchExtendedProfileData(accessToken, profile);
      } catch {
        // Extended data not available, continue with basic profile
        console.log('[LinkedIn] Extended profile data not available (requires partnership)');
      }

      return profile;
    } catch (error) {
      console.error('[LinkedIn] Fetch profile error:', error);
      throw error;
    }
  }

  /**
   * Attempt to fetch extended profile data (requires LinkedIn partnership)
   */
  private async fetchExtendedProfileData(
    accessToken: string,
    profile: LinkedInProfile
  ): Promise<void> {
    // Note: These endpoints require r_fullprofile scope which requires LinkedIn partnership
    // They will fail for regular OAuth apps, so we wrap each in try-catch

    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Try to fetch positions
    try {
      const positionsResponse = await fetch(
        `${LINKEDIN_API_BASE}${ENDPOINTS.POSITIONS}`,
        { headers }
      );
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        profile.positions = positionsData.elements || [];
      }
    } catch {
      // Positions not available
    }

    // Try to fetch education
    try {
      const educationResponse = await fetch(
        `${LINKEDIN_API_BASE}${ENDPOINTS.EDUCATION}`,
        { headers }
      );
      if (educationResponse.ok) {
        const educationData = await educationResponse.json();
        profile.educationEntries = educationData.elements || [];
      }
    } catch {
      // Education not available
    }

    // Try to fetch skills
    try {
      const skillsResponse = await fetch(
        `${LINKEDIN_API_BASE}${ENDPOINTS.SKILLS}`,
        { headers }
      );
      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json();
        profile.skills = skillsData.elements || [];
      }
    } catch {
      // Skills not available
    }
  }

  /**
   * Full import flow - authenticate and fetch profile
   * This method is used by the useLinkedIn hook
   */
  async importProfile(
    authResponse: AuthSession.AuthSessionResult
  ): Promise<LinkedInImportResult> {
    try {
      if (authResponse.type !== 'success') {
        if (authResponse.type === 'cancel' || authResponse.type === 'dismiss') {
          return {
            success: false,
            error: 'Authentication was cancelled',
          };
        }
        return {
          success: false,
          error: 'Authentication failed',
        };
      }

      const { code } = authResponse.params;
      if (!code) {
        return {
          success: false,
          error: 'No authorization code received',
        };
      }

      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(
        code,
        authResponse.params.code_verifier
      );

      // Fetch profile with access token
      const profile = await this.fetchProfile(tokenData.access_token);

      return {
        success: true,
        profile,
      };
    } catch (error) {
      console.error('[LinkedIn] Import profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      };
    }
  }

  /**
   * Check if the LinkedIn client is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.config.clientId);
  }

  /**
   * Validate an access token by making a profile request
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.fetchBasicProfile(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const linkedInService = new LinkedInService();
export default linkedInService;
