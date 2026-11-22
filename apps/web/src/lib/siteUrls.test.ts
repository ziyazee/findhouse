import { describe, expect, it } from 'vitest'
import { brokerSiteUrl, listingPath, listingSiteUrl, mainOrigin, nameSlug, normalizeSubdomain, subdomainOf, subdomainProblem } from './siteUrls'

const live = { protocol: 'https:', hostname: 'findhouse.in', port: '', domain: 'findhouse.in' }
const onSite = { ...live, hostname: 'ravi-homes.findhouse.in' }
const dev = { protocol: 'http:', hostname: 'localhost', port: '5173', domain: 'localhost' }
const off = { ...live, domain: '' }
const flat = { shortId: 'k3f9x2ab', title: '2 BHK in Andheri!' }

describe('subdomains', () => {
  it('reads the broker from the host', () => {
    expect(subdomainOf('ravi-homes.findhouse.in', 'findhouse.in')).toBe('ravi-homes')
    expect(subdomainOf('Ravi-Homes.FindHouse.in', 'findhouse.in')).toBe('ravi-homes')
    expect(subdomainOf('findhouse.in', 'findhouse.in')).toBeNull()
    expect(subdomainOf('www.findhouse.in', 'findhouse.in')).toBeNull()
    expect(subdomainOf('a.b.findhouse.in', 'findhouse.in')).toBeNull()
    expect(subdomainOf('ravi.localhost', 'localhost')).toBe('ravi')
    expect(subdomainOf('ravi-homes.findhouse.in', '')).toBeNull()
  })

  it('builds broker and listing links', () => {
    const ravi = { id: 'b1', subdomain: 'ravi-homes' }
    expect(brokerSiteUrl(live, ravi)).toBe('https://ravi-homes.findhouse.in/')
    expect(brokerSiteUrl(dev, ravi)).toBe('http://ravi-homes.localhost:5173/')
    expect(brokerSiteUrl(live, { id: 'b1', subdomain: null })).toBe('https://findhouse.in/b/b1')
    expect(brokerSiteUrl(off, ravi)).toBe('https://findhouse.in/b/b1')
    expect(listingSiteUrl(live, flat, 'ravi-homes')).toBe('https://ravi-homes.findhouse.in/k3f9x2ab/2-bhk-in-andheri')
    expect(listingSiteUrl(live, flat, null)).toBe('https://findhouse.in/k3f9x2ab/2-bhk-in-andheri')
    expect(listingSiteUrl(onSite, flat, null)).toBe('https://ravi-homes.findhouse.in/k3f9x2ab/2-bhk-in-andheri')
  })

  it('puts the short id and the name in the listing path', () => {
    expect(listingPath(flat)).toBe('/k3f9x2ab/2-bhk-in-andheri')
    expect(listingPath({ shortId: 'k3f9x2ab', title: '!!!' })).toBe('/k3f9x2ab')
    expect(nameSlug('  Sea View — Flat  ')).toBe('sea-view-flat')
  })

  it('finds the main site from a broker subdomain', () => {
    expect(mainOrigin(onSite)).toBe('https://findhouse.in')
    expect(mainOrigin(live)).toBe('https://findhouse.in')
    expect(mainOrigin({ ...dev, hostname: 'ravi.localhost' })).toBe('http://localhost:5173')
  })

  it('checks what a broker types', () => {
    expect(normalizeSubdomain('  Ravi Homes_Realty ')).toBe('ravi-homes-realty')
    expect(subdomainProblem('ravi-homes')).toBeNull()
    expect(subdomainProblem('rv')).toMatch(/at least 3/)
    expect(subdomainProblem('a'.repeat(33))).toMatch(/32 characters/)
    expect(subdomainProblem('ravi.homes')).toMatch(/only lowercase/)
    expect(subdomainProblem('-ravi')).toMatch(/Start and end/)
    expect(subdomainProblem('ravi--homes')).toMatch(/two hyphens/)
    expect(subdomainProblem('admin')).toMatch(/reserved/)
  })
})
