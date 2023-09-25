// import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode, useRef } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  // get CLIENT_ID from environment variables
  const { CLIENT_ID } = process.env;

  async function signIn() {
    try {
      // set isLoggingIn to true
      setIsLoggingIn(true);

      // REDIRECT_URI - create OAuth redirect URI using makeRedirectUri() with "useProxy" option set to true
      const REDIRECT_URI = AuthSession.makeRedirectUri({
        useProxy: true,
        scheme: 'streamData',
        path: 'redirect'
      });

      console.log('REDIRECT_URI: ', REDIRECT_URI);
      // RESPONSE_TYPE - set to "token"
      // SCOPE - create a space-separated list of the following scopes: "openid", "user:read:email" and "user:read:follows"
      // FORCE_VERIFY - set to true
      // STATE - generate random 30-length string using generateRandom() with "size" set to 30
      
      const RESPONSE_TYPE = 'token';
      const SCOPE         = encodeURI('openid user:read:email user:read:follows');
      const FORCE_VERIFY  = true;
      const STATE         = generateRandom(30);

      // assemble authUrl with twitchEndpoint authorization, client_id, 
      // redirect_uri, response_type, scope, force_verify and state

      const authUrl = twitchEndpoints.authorization +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=${RESPONSE_TYPE}` +
      `&scope=${SCOPE}` +
      `&force_verify=${FORCE_VERIFY}` +
      `&state=${STATE}`;

      console.log(authUrl);

      // call startAsync with authUrl      
      const authResponse = await AuthSession.startAsync({ authUrl });

      console.log('authResponse: ', authResponse);

      if (authResponse.type === 'success' && authResponse.params.error !== 'access_denied') {
        
        if (authResponse.params.state !== STATE) {
          throw new Error('Invalid state value');
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${authResponse.params.access_token}`;

        const userResponse = await api.get('/users');

        const [ userData ] = userResponse.data.data

        console.log('userData: ', userData)

        setUser(userData);
        setUserToken(authResponse.params.access_token);
      }

    } catch (error) {
      // throw an error
      console.log(error);
    } finally {
      // set isLoggingIn to false
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      // set isLoggingOut to true
      setIsLoggingIn(true);

      // call revokeAsync with access_token, client_id and twitchEndpoint revocation
      AuthSession.revokeAsync(
        {
          token: userToken,
          clientId: CLIENT_ID,
        },
        {
          revocationEndpoint: twitchEndpoints.revocation
        }
      )
    } catch (error) {
      console.log(error);
    } finally {
      // set user state to an empty User object
      setUser({} as User);
      // set userToken state to an empty string
      setUserToken('');

      // remove "access_token" from request's authorization header
      delete api.defaults.headers.common['Authorization'];

      // set isLoggingOut to false
      setIsLoggingIn(false);
    }
  }

  useEffect(() => {
    // add client_id to request's "Client-Id" header    
    api.defaults.headers.common['Client-ID'] = CLIENT_ID as string;

  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
