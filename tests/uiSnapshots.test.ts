import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from '../src/components/Card';
import Button from '../src/components/Button';
import React from 'react';

describe('UI snapshots', () => {
  it('renders card and button primitives', () => {
    render(
      React.createElement(
        'div',
        null,
        React.createElement(Card, { title: 'Sample' }, 'Body'),
        React.createElement(Button, null, 'Save')
      )
    );

    expect(screen.getByText('Sample')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
