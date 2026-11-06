import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../../files/src/api/client';
import AuthLayout from '../../files/app/(auth)/_layout';
import SignIn from '../../files/app/(auth)/sign-in';
import TabsLayout from '../../files/app/(tabs)/_layout';
import Home from '../../files/app/(tabs)/index';
import Settings from '../../files/app/(tabs)/settings';
import NotFound from '../../files/app/+not-found';
const mockAuth = { signIn: jest.fn(), signOut: jest.fn() };
jest.mock('../../files/src/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => {
    const R = require('react');
    const Stack = ({ screenOptions }) => R.createElement('Stack', { headerShown: screenOptions?.headerShown });
    const Tabs = ({ children }) => R.createElement('Tabs', null, children);
    Tabs.Screen = ({ name, options }) => R.createElement('Screen', { name, title: options.title }, options.tabBarIcon({ color: 'red', size: 8 }));
    return { Stack, Tabs, Link: ({ children }) => R.createElement(require('react-native').Text, null, children) };
});
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
beforeEach(() => { mockAuth.signIn.mockReset(); mockAuth.signOut.mockReset(); });
describe('sign-in screen contract', () => {
    const fill = (email, password) => {
        fireEvent.changeText(screen.getByLabelText('Email'), email);
        fireEvent.changeText(screen.getByLabelText('Password'), password);
    };
    it('keeps the button disabled until email and password are entered, then signs in with the trimmed email', async () => {
        mockAuth.signIn.mockResolvedValue(undefined);
        render(<SignIn />);
        expect(screen.getByRole('button', { name: 'Sign in' }).props.accessibilityState.disabled).toBe(true);
        fill(' a@b.c ', 'pw');
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
        await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalledWith('a@b.c', 'pw'));
    });
    it('says so when the credentials are wrong (401)', async () => {
        mockAuth.signIn.mockRejectedValue(new ApiError(401, 'no'));
        render(<SignIn />);
        fill('a@b.c', 'bad');
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText('Wrong email or password.')).toBeTruthy();
    });
    it('shows the server\'s own answer for a server error, not a connection problem', async () => {
        mockAuth.signIn.mockRejectedValue(new ApiError(500, 'database is down'));
        render(<SignIn />);
        fill('a@b.c', 'pw');
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText('Sign-in failed: database is down')).toBeTruthy();
    });
    it('asks to check the connection when there is no answer or the failure is not an API error', async () => {
        mockAuth.signIn.mockRejectedValue(new ApiError(0, 'Network request failed'));
        render(<SignIn />);
        fill('a@b.c', 'pw');
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText(/Check your connection/)).toBeTruthy();
    });
});
describe('main screens contract', () => {
    it('settings signs out', () => {
        render(<Settings />);
        fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
        expect(mockAuth.signOut).toHaveBeenCalled();
    });
    it('home shows the placeholder state and not-found offers a way home', () => {
        render(<Home />);
        expect(screen.getByText('Nothing here yet.')).toBeTruthy();
        render(<NotFound />);
        expect(screen.getByText('Page not found')).toBeTruthy();
        expect(screen.getByText('Go home')).toBeTruthy();
    });
    it('the layouts declare a headerless auth stack and the Home and Settings tabs', () => {
        expect(render(<AuthLayout />).toJSON()).toMatchObject({ type: 'Stack', props: { headerShown: false } });
        const tabs = JSON.stringify(render(<TabsLayout />).toJSON());
        expect(tabs).toContain('"name":"index","title":"Home"');
        expect(tabs).toContain('"name":"settings","title":"Settings"');
    });
});
