"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Analytics } from "@vercel/analytics/react";
import { Home } from "./components/home";
import { getServerSideConfig } from "./config/server";

const serverConfig = getServerSideConfig();

export default function App() {
  const router = useRouter();

  useEffect(() => {
    router.push('/todo');
  }, []);

  return (
    <>
      <Home />
      {serverConfig?.isVercel && (
        <>
          <Analytics />
        </>
      )}
    </>
  );
}
