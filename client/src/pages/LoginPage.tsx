/**
 * ============================================================
 * LoginPage - Full Page Login/Register with Informative Left Panel
 * Includes inline Forgot Password flow
 * ============================================================
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/components/BrandingProvider";
import { AuthStorage } from "@/lib/auth-storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Mail, KeyRound, Play, RadioTower,
  ShieldCheck, Shield, Lock, ExternalLink, Network, MessageCircle,
} from "lucide-react";
import { useDemoMode } from "@/components/DemoModeBanner";

type ViewType = "login" | "register" | "register-otp" | "forgot-password" | "reset-password";

export default function LoginPage() {
  const { t } = useTranslation();
  const { isDemoMode } = useDemoMode();
  const [location, setLocation] = useLocation();
  const initialTab = location === "/register" ? "register" : "login";
  const [activeView, setActiveView] = useState<ViewType>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [registerOtpCode, setRegisterOtpCode] = useState<string>("");
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { toast } = useToast();
  const { branding } = useBranding();
  const appName = branding.app_name || "AutoComm";
  const tagline = branding.app_tagline || "Communication Operations Platform";

  const loginSchema = z.object({
    email: z.string().email(t("loginPage.errors.invalidEmail")),
    password: z.string().min(1, t("loginPage.errors.passwordRequired")),
  });

  const registerSchema = z.object({
    name: z.string().min(2, t("loginPage.errors.nameLength")),
    email: z.string().email(t("loginPage.errors.invalidEmail")),
    password: z.string().min(8, t("loginPage.errors.passwordLength")),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("loginPage.errors.passwordsMatch"),
    path: ["confirmPassword"],
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email(t("loginPage.errors.invalidEmail")),
  });

  const resetPasswordSchema = z.object({
    otp: z.string().min(6, t("loginPage.errors.otpLength")),
    newPassword: z.string().min(8, t("loginPage.errors.passwordLength")),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t("loginPage.errors.passwordsMatch"),
    path: ["confirmPassword"],
  });

  type LoginFormData = z.infer<typeof loginSchema>;
  type RegisterFormData = z.infer<typeof registerSchema>;
  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
  type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

  // OTP timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otpTimer === 0 && (activeView === 'register-otp' || activeView === 'reset-password')) {
      setCanResendOtp(true);
    }
  }, [otpTimer, activeView]);

  useEffect(() => {
    setLoginError(null);
  }, [activeView]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (isDemoMode) {
      loginForm.reset({ email: "demo@diploy.in", password: "Demo@1234" });
    }
  }, [isDemoMode, loginForm]);

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      AuthStorage.setAuthData(result.token, result.user, result.refreshToken, result.expiresIn);

      toast({ title: t("loginPage.toasts.welcomeBack"), description: t("loginPage.toasts.loginSuccess") });

      const redirectPath = (result.user.role === 'admin' || result.user.role === 'super_admin') ? "/admin" : "/dashboard";
      setLocation(redirectPath);
    } catch (error: any) {
      const raw = (error?.message || "").toLowerCase();
      const isInvalidCredentials =
        raw.includes("invalid credential") ||
        raw.includes("invalid username") ||
        raw.includes("invalid password") ||
        raw.includes("login failed");
      setLoginError(
        isInvalidCredentials
          ? "Authentication failed: Invalid username or password. Please try again."
          : (error.message || t("loginPage.errors.invalidCredentials"))
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Send OTP for registration
  const handleSendRegistrationOTP = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("loginPage.errors.sendOtpFailed"));
      }

      toast({
        title: t("loginPage.toasts.codeSent"),
        description: t("loginPage.toasts.checkEmailAt", { email: data.email }),
      });

      setActiveView('register-otp');
      setOtpTimer(300); // 5 minutes countdown
      setCanResendOtp(false);
      setRegisterOtpCode("");
    } catch (error: any) {
      toast({
        title: t("loginPage.errors.sendOtpFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP for registration
  const handleResendRegistrationOTP = async () => {
    const data = registerForm.getValues();
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("loginPage.errors.sendOtpFailed"));
      }

      toast({
        title: t("loginPage.toasts.codeSent"),
        description: t("loginPage.toasts.otpSent"),
      });

      setOtpTimer(300);
      setCanResendOtp(false);
      setRegisterOtpCode("");
    } catch (error: any) {
      toast({
        title: t("loginPage.errors.sendOtpFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and complete registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerOtpCode.length !== 6) {
      toast({ title: t("loginPage.errors.invalidCode"), description: t("loginPage.errors.otpLength"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // First verify the OTP
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.getValues().email,
          otpCode: registerOtpCode,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.error || t("loginPage.errors.invalidCode"));
      }

      // OTP verified successfully, now complete registration
      const registerData = registerForm.getValues();
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          name: registerData.name,
        }),
      });

      const result = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(result.error || t("loginPage.errors.genericError"));
      }

      AuthStorage.setAuthData(result.token, result.user, result.refreshToken, result.expiresIn);

      toast({
        title: t("loginPage.toasts.registrationSuccess"),
        description: t("loginPage.toasts.welcomeUser", { name: result.user.name }),
      });

      const redirectPath = result.user.role === 'admin' ? "/admin" : "/dashboard";
      setLocation(redirectPath);
    } catch (error: any) {
      toast({
        title: t("loginPage.errors.genericError"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRegisterDetails = () => {
    setActiveView('register');
    setRegisterOtpCode("");
    setOtpTimer(0);
    setCanResendOtp(false);
  };

  const handleForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const result = await response.json();

      if (response.ok) {
        setForgotPasswordEmail(data.email);
        setOtpTimer(300);
        setCanResendOtp(false);
        setActiveView("reset-password");
        toast({ title: t("loginPage.toasts.codeSent"), description: t("loginPage.rightPanel.form.checkEmail") });
      } else {
        toast({ title: t("loginPage.errors.sendOtpFailed"), description: result.error || t("loginPage.errors.genericError"), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t("loginPage.errors.sendOtpFailed"), description: error.message || t("loginPage.errors.genericError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendForgotPasswordOTP = async () => {
    if (otpTimer > 0) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      const result = await response.json();

      if (response.ok) {
        setOtpTimer(300);
        setCanResendOtp(false);
        toast({ title: t("loginPage.toasts.codeSent"), description: t("loginPage.rightPanel.form.checkEmail") });
      } else {
        toast({ title: t("loginPage.errors.genericError"), description: result.error || t("loginPage.errors.genericError"), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t("loginPage.errors.genericError"), description: error.message || t("loginPage.errors.genericError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      // First verify OTP
      const verifyResponse = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail, otpCode: data.otp }),
      });
      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        toast({ title: t("loginPage.errors.invalidCode"), description: verifyResult.error || t("loginPage.errors.checkCode"), variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Then reset password
      const resetResponse = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotPasswordEmail,
          newPassword: data.newPassword
        }),
      });
      const resetResult = await resetResponse.json();

      if (resetResponse.ok) {
        toast({ title: t("loginPage.toasts.passwordReset"), description: t("loginPage.toasts.loginWithNew") });
        resetPasswordForm.reset();
        forgotPasswordForm.reset();
        setActiveView("login");
      } else {
        toast({ title: t("loginPage.errors.resetPasswordFailed"), description: resetResult.error || t("loginPage.errors.genericError"), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t("loginPage.errors.resetPasswordFailed"), description: error.message || t("loginPage.errors.genericError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getCardTitle = () => {
    switch (activeView) {
      case "login": return "Welcome back";
      case "register": return t("loginPage.rightPanel.titles.create");
      case "register-otp": return t("loginPage.rightPanel.titles.verify");
      case "forgot-password": return t("loginPage.rightPanel.titles.forgot");
      case "reset-password": return t("loginPage.rightPanel.titles.reset");
    }
  };

  const getCardDescription = () => {
    switch (activeView) {
      case "login": return "Sign in with your enterprise credentials to access the communication console.";
      case "register": return t("loginPage.rightPanel.descriptions.create");
      case "register-otp": return t("loginPage.rightPanel.descriptions.verify", { email: registerForm.getValues().email });
      case "forgot-password": return t("loginPage.rightPanel.descriptions.forgot");
      case "reset-password": return t("loginPage.rightPanel.descriptions.reset", { email: forgotPasswordEmail });
    }
  };

  const fieldClass =
    "h-11 pl-10 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:ring-[#0066FF]/20 focus-visible:border-[#0066FF]";
  const primaryBtnClass =
    "w-full h-11 rounded-lg bg-[#0066FF] hover:bg-[#0057db] text-white font-semibold shadow-none border-0";

  return (
    <>
      <div className="fixed inset-0 overflow-hidden grid lg:grid-cols-[40%_60%] bg-white" data-testid="login-page">
          <aside className="hidden lg:flex flex-col h-full overflow-hidden bg-[#f4f7fb] px-6 pt-10 pb-6 sm:px-8 sm:pt-12 xl:px-8 xl:pt-14 xl:pb-8 border-r border-slate-100">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#0066FF] flex items-center justify-center shrink-0 shadow-sm">
                <RadioTower className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[20px] font-bold text-slate-950 leading-none">{appName}</h1>
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-[#0066FF] bg-[#e8f1ff] px-2 py-0.5 rounded-full">
                    CORE OPS
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-1">{tagline}</p>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-white border border-slate-200/80 px-3 py-1 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-slate-600">WhatsApp API &amp; Voice Gateway Operational</span>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">DUAL-CHANNEL ENGINE</p>
                  <h2 className="mt-2 text-[16px] font-bold text-slate-950 leading-snug">
                    Enterprise Dual-Channel Orchestration
                  </h2>
                </div>
                <div className="h-8 w-8 rounded-lg bg-[#e8f1ff] flex items-center justify-center shrink-0">
                  <Network className="h-4 w-4 text-[#0066FF]" />
                </div>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                Synchronous Meta Cloud WhatsApp dispatch alongside Neural Voice IVR streaming at sub-200ms latency.
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="flex items-end gap-[3px] h-8">
                  {[10, 18, 12, 26, 14, 22, 9, 20, 13, 24, 11, 28, 8, 16, 12, 22].map((h, i) => (
                    <span
                      key={i}
                      className={`w-[5px] rounded-full ${i % 3 === 0 ? "bg-emerald-400" : "bg-[#0066FF]"}`}
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-emerald-500 whitespace-nowrap">99.98% Live</span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-950">SOC2 Type II &amp; TCPA Compliant</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  Automated opt-out enforcement &amp; end-to-end ledger logging
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center justify-between gap-4">
                <span>Active Cluster Topology</span>
                <span className="text-slate-500">Node-US-01 • v2.4.8-prod</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Mutual TLS Identity</span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Hardware 2FA Active
                </span>
              </div>
            </div>
          </aside>

          <section className="flex flex-col h-full overflow-hidden bg-white px-6 pt-10 pb-6 sm:px-8 sm:pt-12 xl:px-16 xl:pt-14 xl:pb-8">
            <div className="w-full max-w-[460px] mx-auto flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] text-[#0066FF] text-[12px] font-medium px-3 py-1">
                <Lock className="h-3.5 w-3.5" />
                SSO-Ready Session
              </span>
              <Link href="/contact" className="inline-flex items-center gap-1.5 text-[13px] text-[#0066FF] hover:underline">
                Help Center
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="lg:hidden mt-3 flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-xl bg-[#0066FF] flex items-center justify-center">
                <RadioTower className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-950">{appName}</span>
                  <span className="text-[9px] font-semibold tracking-[0.12em] text-[#0066FF] bg-[#e8f1ff] px-1.5 py-0.5 rounded-full">
                    CORE OPS
                  </span>
                </div>
                <p className="text-xs text-slate-500">{tagline}</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <h2 className="text-[30px] leading-tight font-bold text-slate-950">{getCardTitle()}</h2>
              <p className="mt-2 text-[14px] text-slate-500 max-w-md">{getCardDescription()}</p>

              {activeView === "login" && (
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="mt-6 space-y-4">
                  {isDemoMode && (
                    <div className="p-2.5 bg-[#eef5ff] border border-[#d6e6ff] rounded-lg text-xs space-y-1.5 text-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-[#0066FF] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse" />
                          Demo Credentials:
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsVideoOpen(true)}
                          className="h-7 px-2.5 text-xs text-[#0066FF] hover:text-[#0066FF] hover:bg-[#e8f1ff] font-semibold"
                        >
                          <Play className="w-3.5 h-3.5 fill-current mr-1" />
                          Watch Demo Video
                        </Button>
                      </div>
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          Email: <span className="font-mono bg-white px-1.5 py-0.5 rounded select-all font-semibold">demo@diploy.in</span>
                        </div>
                        <div>
                          Password: <span className="font-mono bg-white px-1.5 py-0.5 rounded select-all font-semibold">Demo@1234</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {loginError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                      data-testid="login-error-alert"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold leading-none text-white">
                        !
                      </span>
                      <p className="text-[13px] leading-relaxed text-red-800">{loginError}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="login-email" className="text-[13px] font-medium text-slate-800">
                        Username or Corporate Email
                      </Label>
                      <span className="text-[11px] text-slate-400">Single Sign-On enabled</span>
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="alex.vance@autocomm.io"
                        className={fieldClass}
                        {...loginForm.register("email")}
                        data-testid="input-login-email"
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="login-password" className="text-[13px] font-medium text-slate-800">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          forgotPasswordForm.setValue("email", loginForm.getValues("email"));
                          setActiveView("forgot-password");
                        }}
                        className="text-[13px] text-[#0066FF] hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••••"
                        className={`${fieldClass} pr-11`}
                        {...loginForm.register("password")}
                        data-testid="input-login-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="remember-device"
                        checked={rememberDevice}
                        onCheckedChange={(checked) => setRememberDevice(checked === true)}
                        className="border-slate-300 data-[state=checked]:bg-[#0066FF] data-[state=checked]:border-[#0066FF]"
                      />
                      <span className="text-[13px] text-slate-700">Remember this device for 30 days</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Shield className="h-3.5 w-3.5" />
                      FIPS 140-2
                    </span>
                  </div>

                  <Button type="submit" className={primaryBtnClass} disabled={isLoading} data-testid="button-login-submit">
                    {isLoading ? t("loginPage.rightPanel.form.signingIn") : `Sign In to ${appName}`}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              )}

              {activeView === "register" && (
                <form onSubmit={registerForm.handleSubmit(handleSendRegistrationOTP)} className="mt-4 space-y-3">
                  {isDemoMode && (
                    <div className="p-3.5 bg-[#eef5ff] border border-[#d6e6ff] rounded-xl text-xs text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0066FF]">Demo Mode Active</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsVideoOpen(true)}
                          className="h-7 px-2.5 text-xs text-[#0066FF] hover:bg-[#e8f1ff]"
                        >
                          <Play className="w-3.5 h-3.5 fill-current mr-1" />
                          Watch Demo Video
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.fullName")}
                    </Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder={t("loginPage.rightPanel.form.fullNamePlaceholder")}
                      className="h-10 rounded-lg border-slate-200"
                      {...registerForm.register("name")}
                      data-testid="input-register-name"
                    />
                    {registerForm.formState.errors.name && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder={t("loginPage.rightPanel.form.emailPlaceholder")}
                        className={fieldClass}
                        {...registerForm.register("email")}
                        data-testid="input-register-email"
                      />
                    </div>
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.password")}
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("loginPage.rightPanel.form.createPassword")}
                        className={`${fieldClass} pr-11`}
                        {...registerForm.register("password")}
                        data-testid="input-register-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.confirmPassword")}
                    </Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder={t("loginPage.rightPanel.form.confirmPasswordPlaceholder")}
                      className="h-10 rounded-lg border-slate-200"
                      {...registerForm.register("confirmPassword")}
                      data-testid="input-register-confirm"
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" className={primaryBtnClass} disabled={isLoading} data-testid="button-register-submit">
                    {isLoading ? t("loginPage.rightPanel.form.sendingCode") : t("loginPage.rightPanel.form.sendCode")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setActiveView("login")}
                    className="w-full text-[13px] text-slate-500 hover:text-[#0066FF]"
                    data-testid="tab-login"
                  >
                    Already have an account? Sign in
                  </button>
                </form>
              )}

              {activeView === "register-otp" && (
                <form onSubmit={handleVerifyAndRegister} className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="register-otp" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.verificationCode")}
                    </Label>
                    <Input
                      id="register-otp"
                      type="text"
                      placeholder={t("loginPage.rightPanel.form.otpPlaceholder")}
                      maxLength={6}
                      value={registerOtpCode}
                      onChange={(e) => setRegisterOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="h-10 rounded-lg border-slate-200 text-center text-lg tracking-widest"
                      data-testid="input-register-otp"
                    />
                    {otpTimer > 0 && (
                      <p className="text-sm text-slate-500 text-center">
                        {t("loginPage.rightPanel.form.codeExpires")} {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className={primaryBtnClass}
                    disabled={isLoading || registerOtpCode.length !== 6}
                    data-testid="button-verify-register"
                  >
                    {isLoading ? t("loginPage.rightPanel.form.verifying") : t("loginPage.rightPanel.form.verifyButton")}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200"
                      onClick={handleBackToRegisterDetails}
                      disabled={isLoading}
                      data-testid="button-back-register"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {t("loginPage.rightPanel.form.back")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200"
                      onClick={handleResendRegistrationOTP}
                      disabled={isLoading || !canResendOtp}
                      data-testid="button-resend-register-otp"
                    >
                      {canResendOtp
                        ? t("loginPage.rightPanel.form.resendCode")
                        : t("loginPage.rightPanel.form.resendIn", { time: `${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, "0")}` })}
                    </Button>
                  </div>
                </form>
              )}

              {activeView === "forgot-password" && (
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPasswordSubmit)} className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder={t("loginPage.rightPanel.form.emailPlaceholder")}
                        className={fieldClass}
                        {...forgotPasswordForm.register("email")}
                        data-testid="input-forgot-email"
                      />
                    </div>
                    {forgotPasswordForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{forgotPasswordForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <Button type="submit" className={primaryBtnClass} disabled={isLoading} data-testid="button-send-code">
                    {isLoading ? t("loginPage.rightPanel.form.sending") : t("loginPage.rightPanel.form.sendResetCode")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setActiveView("login")}
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t("loginPage.rightPanel.form.backToLogin")}
                  </Button>
                </form>
              )}

              {activeView === "reset-password" && (
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="reset-otp" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.verificationCode")}
                    </Label>
                    <Input
                      id="reset-otp"
                      type="text"
                      placeholder={t("loginPage.rightPanel.form.otpPlaceholder")}
                      maxLength={6}
                      className="h-10 rounded-lg border-slate-200 text-center text-lg tracking-widest"
                      {...resetPasswordForm.register("otp")}
                      data-testid="input-reset-otp"
                    />
                    {resetPasswordForm.formState.errors.otp && (
                      <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.otp.message}</p>
                    )}
                    <div className="flex justify-center">
                      {otpTimer > 0 ? (
                        <span className="text-sm text-slate-500">
                          {t("loginPage.rightPanel.form.resendIn", { time: `${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, "0")}` })}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendForgotPasswordOTP}
                          className="text-sm text-[#0066FF] hover:underline"
                          disabled={isLoading}
                          data-testid="button-resend-otp"
                        >
                          {t("loginPage.rightPanel.form.resendCode")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-password" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.newPassword")}
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="reset-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("loginPage.rightPanel.form.newPasswordPlaceholder")}
                        className={`${fieldClass} pr-11`}
                        {...resetPasswordForm.register("newPassword")}
                        data-testid="input-reset-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {resetPasswordForm.formState.errors.newPassword && (
                      <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm" className="text-[13px] font-medium text-slate-800">
                      {t("loginPage.rightPanel.form.confirmNewPassword")}
                    </Label>
                    <Input
                      id="reset-confirm"
                      type="password"
                      placeholder={t("loginPage.rightPanel.form.confirmNewPasswordPlaceholder")}
                      className="h-10 rounded-lg border-slate-200"
                      {...resetPasswordForm.register("confirmPassword")}
                      data-testid="input-reset-confirm"
                    />
                    {resetPasswordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" className={primaryBtnClass} disabled={isLoading} data-testid="button-reset-password">
                    {isLoading ? t("loginPage.rightPanel.form.resetting") : t("loginPage.rightPanel.form.resetPassword")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setActiveView("forgot-password");
                      resetPasswordForm.reset();
                    }}
                    data-testid="button-back-to-email"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t("loginPage.rightPanel.form.changeEmail")}
                  </Button>
                </form>
              )}
            </div>

            <div className="shrink-0 pt-4">
              {activeView === "login" && (
                <p className="text-center text-[13px] text-slate-500 mb-4">
                  New to {appName}?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveView("register")}
                    className="text-[#0066FF] font-medium hover:underline"
                    data-testid="tab-register"
                  >
                    Create an account
                  </button>
                </p>
              )}
              <p className="flex items-center gap-2 text-[12px] text-emerald-600">
                <Lock className="h-3.5 w-3.5" />
                Protected by {appName} Zero-Trust Security. Hardware key 2FA supported.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-slate-500 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    System Status
                  </span>
                  <Link href="/terms" className="hover:text-[#0066FF]">Terms of Service</Link>
                  <Link href="/privacy" className="hover:text-[#0066FF]">Privacy Policy</Link>
                </div>
                <Link href="/contact" className="inline-flex items-center gap-1.5 hover:text-[#0066FF]">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Need Help?
                </Link>
              </div>
            </div>
            </div>
          </section>
      </div>

      {isDemoMode && (
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-emerald-400 fill-emerald-400" />
                {appName} {activeView === "register" ? "Sign Up" : "Live"} Demonstration
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Watch how {appName} powers AI voice agents, outbound calls, and real-time voice workflows.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
              {isVideoOpen && (
                <iframe
                  src={
                    activeView === "register"
                      ? "https://drive.google.com/file/d/1rZLRzQzf8N6TOhJlAGN1MxZJBCtkkstk/preview"
                      : "https://drive.google.com/file/d/12P10ehRmXueHJETBJM1-O66JFsvWKkV4/preview"
                  }
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title="AgentLabs Demo Video"
                />
              )}
            </div>
            <div className="p-3 pt-2 text-right">
              <a
                href={
                  activeView === "register"
                    ? "https://drive.google.com/file/d/1rZLRzQzf8N6TOhJlAGN1MxZJBCtkkstk/view?usp=sharing"
                    : "https://drive.google.com/file/d/12P10ehRmXueHJETBJM1-O66JFsvWKkV4/view?usp=sharing"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:underline inline-flex items-center gap-1 font-medium"
              >
                Open in Google Drive &rarr;
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
