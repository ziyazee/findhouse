import { describe, expect, it } from 'vitest'
import { parseRegistration } from './register'

const ok = { phone: '+91 98765 43210', name: ' Rubbing ', password: 'long-enough-pass' }

describe('parseRegistration', () => {
  it('normalizes the number and trims the name', () => {
    expect(parseRegistration(ok)).toEqual({ phone: '919876543210', name: 'Rubbing', password: 'long-enough-pass' })
  })

  it.each([
    [{ ...ok, phone: '12345' }, 'invalid_phone'],
    [{ ...ok, password: 'short' }, 'weak_password'],
    [{ ...ok, name: '' }, 'invalid_name'],
    [{ ...ok, name: 'ab' }, 'invalid_name'],
    [{ ...ok, name: '!!!' }, 'invalid_name'],
    [{ ...ok, name: 'x'.repeat(81) }, 'invalid_name'],
    [{ ...ok, name: 'Admin' }, 'name_reserved'],
    [{ ...ok, name: 'WWW' }, 'name_reserved'],
    [null, 'invalid_phone'],
  ])('refuses %j', (body, code) => {
    expect(parseRegistration(body)).toEqual({ code })
  })
})
