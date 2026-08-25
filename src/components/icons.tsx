import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
}

function svg(path: ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 16, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    )
  }
}

export const IconPlay = svg(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />)
export const IconPause = svg(
  <>
    <rect x="7" y="4.5" width="3.6" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.4" y="4.5" width="3.6" height="15" rx="1" fill="currentColor" stroke="none" />
  </>,
)
export const IconStart = svg(
  <>
    <path d="M18.5 5.5v13L9 12z" fill="currentColor" stroke="none" />
    <path d="M6 5v14" />
  </>,
)
export const IconEnd = svg(
  <>
    <path d="M5.5 5.5v13L15 12z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </>,
)
export const IconBack = svg(
  <>
    <path d="M11 6v12l-8-6z" fill="currentColor" stroke="none" />
    <path d="M20 6v12l-8-6z" fill="currentColor" stroke="none" />
  </>,
)
export const IconForward = svg(
  <>
    <path d="M4 6v12l8-6z" fill="currentColor" stroke="none" />
    <path d="M13 6v12l8-6z" fill="currentColor" stroke="none" />
  </>,
)
export const IconVolume = svg(
  <>
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
    <path d="M16 9.2a4 4 0 0 1 0 5.6" />
    <path d="M18.6 6.6a7.5 7.5 0 0 1 0 10.8" />
  </>,
)
export const IconMute = svg(
  <>
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
    <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
  </>,
)
export const IconUndo = svg(
  <>
    <path d="M3.5 10.5h11a5 5 0 0 1 0 10H10" />
    <path d="m7.5 6-4 4.5 4 4.5" />
  </>,
)
export const IconRedo = svg(
  <>
    <path d="M20.5 10.5h-11a5 5 0 0 0 0 10H14" />
    <path d="m16.5 6 4 4.5-4 4.5" />
  </>,
)
export const IconScissors = svg(
  <>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M20 4 8.4 16.4M8.4 7.6 20 20" />
  </>,
)
export const IconSplit = svg(
  <>
    <path d="M12 3v18" strokeDasharray="3 3" />
    <path d="M4.5 7.5h4v9h-4zM15.5 7.5h4v9h-4z" />
  </>,
)
export const IconTrash = svg(
  <>
    <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
    <path d="M10.5 10v6M13.5 10v6" />
  </>,
)
export const IconRestore = svg(
  <>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4v5h5" />
  </>,
)
export const IconEyeOff = svg(
  <>
    <path d="M10.6 6.2A9 9 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.9 3.4M6.5 7.7C3.9 9.4 3 12 3 12s4 6 9 6a8.7 8.7 0 0 0 4-1" />
    <path d="m3 3 18 18" />
    <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
  </>,
)
export const IconEye = svg(
  <>
    <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
)
export const IconWand = svg(
  <>
    <path d="m4 20 10.5-10.5" />
    <path d="M17 3.5 18 6l2.5 1-2.5 1-1 2.5L16 8l-2.5-1L16 6z" fill="currentColor" />
    <path d="m13.5 7.5 3 3" />
  </>,
)
export const IconExport = svg(
  <>
    <path d="M12 3v12" />
    <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
    <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
  </>,
)
export const IconUpload = svg(
  <>
    <path d="M12 16V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" />
  </>,
)
export const IconFilm = svg(
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M7.5 4.5v15M16.5 4.5v15M3 12h18M3 8.2h4.5M3 15.8h4.5M16.5 8.2H21M16.5 15.8H21" />
  </>,
)
export const IconZoomIn = svg(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.6-4.6M10.5 8v5M8 10.5h5" />
  </>,
)
export const IconZoomOut = svg(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.6-4.6M8 10.5h5" />
  </>,
)
export const IconClose = svg(<path d="m6 6 12 12M18 6 6 18" />)
export const IconCheck = svg(<path d="m4.5 12.5 5 5 10-11" />)
export const IconAlert = svg(
  <>
    <path d="M12 3.5 21 19.5H3z" />
    <path d="M12 9.5v4.5M12 17h.01" />
  </>,
)
export const IconInfo = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6h.01" />
  </>,
)
export const IconSettings = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-2.72 1.13V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.1 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 3 14.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.1l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.9 1.13l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.6 1z" />
  </>,
)
export const IconLogout = svg(
  <>
    <path d="M14 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H14" />
    <path d="M17 15.5 20.5 12 17 8.5M20.5 12H10" />
  </>,
)
export const IconArrowLeft = svg(<path d="M19 12H5m0 0 6-6m-6 6 6 6" />)
export const IconArrowRight = svg(<path d="M5 12h14m0 0-6-6m6 6-6 6" />)
export const IconSpinner = svg(
  <>
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </>,
)
export const IconLock = svg(
  <>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </>,
)
