import axios from 'axios';
import { env } from '../config/env';

export type GetUserIdFromTokenResponse = {
  userId: string;
};

export const verifyToken = async (
  accessToken: string,
): Promise<{ userId: string }> => {
  const { data } = await axios.post<GetUserIdFromTokenResponse>(
    `${env.auth.introspectUrl}`,
    {},
    {
      headers: {
        'x-auth-token': accessToken,
      },
    },
  );
  return data;
};
