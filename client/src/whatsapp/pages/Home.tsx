/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */

import React from "react";
import Hero from "@wa/components/Hero";
import Features from "@wa/components/Features";
import HowItWorks from "@wa/components/HowItWorks";
import UseCases from "@wa/components/UseCases";
import Testimonials from "@wa/components/Testimonials";
import Pricing from "@wa/components/Pricing";
import CTA from "@wa/components/CTA";
import { useQuery } from "@tanstack/react-query";
import { PlansDataTypes } from "@wa/types/types";
import Header from "@wa/components/Header";
import Footer from "@wa/components/Footer";

const Home = () => {
  const { data: paymentProviders } = useQuery<PlansDataTypes>({
    queryKey: ["/api/whatsapp/admin/plans"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/admin/plans");
      return res.json();
    },
  });
  return (
    <>
      {/* <Header /> */}
      <Hero />
      <Features />
      <HowItWorks />
      <UseCases />
      <Testimonials />
      {paymentProviders?.success && paymentProviders?.data?.length > 0 && (
        <Pricing />
      )}
      <CTA />
      {/* <Footer /> */}
    </>
  );
};

export default Home;
