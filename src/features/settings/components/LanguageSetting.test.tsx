// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { LanguageSetting } from './LanguageSetting'

const mocks = vi.hoisted(() => ({
  sync: vi.fn(async () => {}),
  setLocale: vi.fn(),
  reload: vi.fn(),
  locale: 'en',
}))
vi.mock('#/features/shared/utils/pushLocaleSync', () => ({
  syncPushLocale: mocks.sync,
}))
vi.mock('#/paraglide/runtime.js', async (orig) => ({
  ...(await orig<object>()),
  getLocale: () => mocks.locale,
  setLocale: mocks.setLocale,
}))
vi.mock('../utils/languagePreference', async (orig) => ({
  ...(await orig<object>()),
  reloadPage: mocks.reload,
}))

beforeEach(() => {
  mocks.locale = 'en'
  document.cookie = 'PARAGLIDE_LOCALE=; Max-Age=0; path=/'
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.cookie = 'PARAGLIDE_LOCALE=; Max-Age=0; path=/'
})

describe('LanguageSetting', () => {
  it('renders three options in English', () => {
    render(<LanguageSetting />)
    const select = screen.getByLabelText('Language')
    expect(select).toHaveValue('auto')
    expect(
      Array.from(select.querySelectorAll('option')).map((o) => o.textContent),
    ).toEqual(['Automatic', 'English', 'Dansk'])
  })

  it('renders Danish labels', () => {
    mocks.locale = 'da'
    render(<LanguageSetting />)
    expect(
      Array.from(screen.getByLabelText('Sprog').querySelectorAll('option')).map(
        (o) => o.textContent,
      ),
    ).toEqual(['Automatisk', 'English', 'Dansk'])
  })

  it('reflects a stored cookie after mount', async () => {
    document.cookie = 'PARAGLIDE_LOCALE=da; path=/'
    render(<LanguageSetting />)
    await waitFor(() =>
      expect(screen.getByLabelText('Language')).toHaveValue('da'),
    )
  })

  it('syncs push locale then sets the locale', async () => {
    render(<LanguageSetting />)
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'da')
    await waitFor(() => expect(mocks.setLocale).toHaveBeenCalledWith('da'))
    expect(mocks.sync).toHaveBeenCalledWith('da')
    expect(mocks.sync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setLocale.mock.invocationCallOrder[0],
    )
  })

  describe('with a hanging push sync', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mocks.sync.mockImplementationOnce(() => new Promise<void>(() => {}))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('disables the select while the sync is pending', async () => {
      render(<LanguageSetting />)
      await userEvent.selectOptions(screen.getByLabelText('Language'), 'da')
      expect(screen.getByLabelText('Language')).toBeDisabled()
      expect(mocks.setLocale).not.toHaveBeenCalled()
    })

    it('still sets the locale after the timeout', async () => {
      render(<LanguageSetting />)
      await userEvent.selectOptions(screen.getByLabelText('Language'), 'da')
      await vi.advanceTimersByTimeAsync(3000)
      expect(mocks.setLocale).toHaveBeenCalledWith('da')
    })
  })

  it('still sets the locale when the sync rejects', async () => {
    mocks.sync.mockRejectedValueOnce(new Error('boom'))
    render(<LanguageSetting />)
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'da')
    await waitFor(() => expect(mocks.setLocale).toHaveBeenCalledWith('da'))
  })

  it('Automatic clears the cookie and reloads', async () => {
    document.cookie = 'PARAGLIDE_LOCALE=da; path=/'
    render(<LanguageSetting />)
    await waitFor(() =>
      expect(screen.getByLabelText('Language')).toHaveValue('da'),
    )
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'auto')
    expect(document.cookie).not.toContain('PARAGLIDE_LOCALE')
    expect(mocks.reload).toHaveBeenCalled()
  })
})
