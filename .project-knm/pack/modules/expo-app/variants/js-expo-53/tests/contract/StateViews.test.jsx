import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Empty, ErrorState, Loading, MIN_TAP } from '../../files/src/ui/StateViews';
describe('state views contract', () => {
    it('Loading is announced as a progress bar', () => {
        render(<Loading label="Loading items"/>);
        expect(screen.getByLabelText('Loading items')).toBeTruthy();
    });
    it('Empty shows its message and runs the action', () => {
        const onAction = jest.fn();
        render(<Empty message="Nothing yet" actionLabel="Reload" onAction={onAction}/>);
        expect(screen.getByText('Nothing yet')).toBeTruthy();
        fireEvent.press(screen.getByText('Reload'));
        expect(onAction).toHaveBeenCalledTimes(1);
    });
    it('Empty has no button without an action', () => {
        render(<Empty message="Nothing yet"/>);
        expect(screen.queryByText('Reload')).toBeNull();
    });
    it('ErrorState is an alert with a generic message and a retry', () => {
        const onRetry = jest.fn();
        render(<ErrorState onRetry={onRetry}/>);
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText('Something went wrong.')).toBeTruthy();
        fireEvent.press(screen.getByText('Try again'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
    it('tap targets are at least 44 points', () => {
        expect(MIN_TAP).toBeGreaterThanOrEqual(44);
    });
});
