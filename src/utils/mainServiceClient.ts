import axios from "axios";

const KORNER_MAIN_URL = process.env.KORNER_MAIN_URL || "http://localhost:3001";

export interface UserProfile {
  id: number;
  userId: number;
  username: string;
  displayName?: string;
}

export interface TextBarDetails {
  textAlign: string;
  headerPosition: string;
  link: string;
  description: string;
  textTheme: {
    textColor: string;
    backgroundColor: string;
    linkBackgroundColor: string;
  };
}

export interface CreateBarPayload {
  profileId: number;
  type: string;
  title: string;
  size: string;
  order: number;
  status: string;
  price: null;
  thumbnail: null;
  details: TextBarDetails;
  monetizedDetails: {
    price: null;
    currencyCode: null;
    isAdult: boolean;
  };
  isMonetized: boolean;
}

/**
 * Get user profile from korner-main-service
 */
export const getProfileByToken = async (
  token: string
): Promise<UserProfile | null> => {
  try {
    const response = await axios.get(`${KORNER_MAIN_URL}/internal/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch {
    return null;
  }
};

/**
 * Get max bar order for a profile from korner-main-service
 */
export const getMaxBarOrder = async (
  profileId: number,
  token: string
): Promise<number> => {
  try {
    const response = await axios.get(
      `${KORNER_MAIN_URL}/internal/bars/max-order/${profileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.maxOrder ?? 0;
  } catch {
    return 0;
  }
};

/**
 * Create a text bar via korner-main-service
 */
export const createTextBar = async (
  payload: CreateBarPayload,
  token: string
): Promise<any> => {
  const response = await axios.post(
    `${KORNER_MAIN_URL}/internal/bars`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

/**
 * Invalidate profile bars cache via korner-main-service
 */
export const invalidateProfileBarsCache = async (
  profileId: number,
  token: string
): Promise<void> => {
  try {
    await axios.delete(
      `${KORNER_MAIN_URL}/internal/cache/bars/${profileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    // Non-critical
  }
};
