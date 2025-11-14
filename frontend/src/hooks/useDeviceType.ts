'use client'

import { useState, useEffect } from 'react'

export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkMobile = () => {
      // Consider mobile if width is less than 768px (Tailwind md breakpoint)
      setIsMobile(window.innerWidth < 768)
      setIsLoading(false)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return { 
    isMobile, 
    isDesktop: !isMobile,
    isLoading 
  }
}

