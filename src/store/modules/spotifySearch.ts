import { createAsyncThunk, createReducer, createAction } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'
import { LOGOUT } from 'shared/actionTypes'
import type { SpotifyTrack } from 'shared/types'

const api = new HttpApi('spotify')

// ------------------------------------
// Actions
// ------------------------------------
const logout = createAction(LOGOUT)

export const spotifySearchClear = createAction('spotifySearch/CLEAR')

export const spotifySearch = createAsyncThunk(
  'spotifySearch/SEARCH',
  async (query: string) => {
    try {
      const response = await api.get<{ tracks: SpotifyTrack[] }>(`/search?q=${encodeURIComponent(query)}`)
      return response.tracks
    } catch {
      // fail silently — don't trigger global error modal
      return [] as SpotifyTrack[]
    }
  },
)

export const fetchSpotifyStatus = createAsyncThunk(
  'spotifySearch/STATUS',
  async () => {
    return api.get<{ isConfigured: boolean, isConnected: boolean }>('/status')
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
export interface SpotifySearchState {
  isSearching: boolean
  results: SpotifyTrack[]
  error: string | null
  isConfigured: boolean
  isConnected: boolean
}

const initialState: SpotifySearchState = {
  isSearching: false,
  results: [],
  error: null,
  isConfigured: false,
  isConnected: false,
}

const spotifySearchReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(spotifySearch.pending, (state) => {
      state.isSearching = true
      state.error = null
    })
    .addCase(spotifySearch.fulfilled, (state, { payload }) => {
      state.isSearching = false
      state.results = payload
    })
    .addCase(spotifySearch.rejected, (state, { error }) => {
      state.isSearching = false
      state.error = error.message || 'Search failed'
      state.results = []
    })
    .addCase(spotifySearchClear, (state) => {
      state.isSearching = false
      state.results = []
      state.error = null
    })
    .addCase(fetchSpotifyStatus.fulfilled, (state, { payload }) => {
      state.isConfigured = payload.isConfigured
      state.isConnected = payload.isConnected
    })
    .addCase(logout, () => initialState)
})

export default spotifySearchReducer
