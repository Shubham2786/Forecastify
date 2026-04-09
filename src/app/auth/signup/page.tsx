"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, BarChart3, Store, User, Mail, Phone, MapPin, Building2, ShoppingBag } from "lucide-react";

const storeCategories = [
  "Grocery & Supermarket", "Electronics & Appliances", "Fashion & Apparel",
  "Pharmacy & Health", "Home & Furniture", "Sports & Outdoors",
  "Beauty & Personal Care", "Food & Beverage", "Department Store",
  "Convenience Store", "Other",
];

const storeSizes = [
  "Small (1-5 employees)", "Medium (6-25 employees)",
  "Large (26-100 employees)", "Enterprise (100+ employees)",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "", email: "", phone: "", password: "", confirmPassword: "",
    storeName: "", storeCategory: "", storeSize: "", storeAddress: "",
    city: "", state: "", pincode: "", gstNumber: "", numberOfOutlets: "1",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password) {
      setError("Please fill in all required fields"); return false;
    }
    if (formData.password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return false; }
    setError(""); return true;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName || !formData.storeCategory || !formData.storeSize) {
      setError("Please fill in all required store details"); return;
    }
    setError(""); setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName, phone: formData.phone,
            store_name: formData.storeName, store_category: formData.storeCategory,
            store_size: formData.storeSize, store_address: formData.storeAddress,
            city: formData.city, state: formData.state, pincode: formData.pincode,
            gst_number: formData.gstNumber, number_of_outlets: formData.numberOfOutlets,
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        if (error.message.toLowerCase().includes("rate limit")) {
          setError("Too many signup attempts. Please wait a few minutes and try again.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Update profile with store details
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name: formData.fullName,
            phone: formData.phone,
            store_name: formData.storeName,
            store_category: formData.storeCategory,
            store_size: formData.storeSize,
            store_address: formData.storeAddress,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            gst_number: formData.gstNumber || null,
            number_of_outlets: parseInt(formData.numberOfOutlets) || 1,
          });

        if (profileError) {
          console.error("Profile update error:", profileError);
        }

        if (data.session) {
          router.push("/dashboard");
        } else {
          // Email confirmation is enabled — sign in directly
          const { data: loginData } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (loginData?.session) {
            router.push("/dashboard");
          } else {
            setError("Account created! Please check your email to confirm, then log in.");
            setLoading(false);
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Forecastify</h1>
          </div>
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-6">Set up your store<br />in minutes</h2>
          <p className="text-lg text-white/80 mb-10 max-w-sm">
            Join hundreds of retailers using AI to optimize their inventory and boost profits.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? "bg-white text-indigo-600" : "bg-white/20"}`}>1</div>
              <div><p className="font-semibold">Personal Information</p><p className="text-sm text-white/60">Your account credentials</p></div>
            </div>
            <div className="ml-5 border-l-2 border-white/20 h-6" />
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? "bg-white text-indigo-600" : "bg-white/20"}`}>2</div>
              <div><p className="font-semibold">Store Details</p><p className="text-sm text-white/60">Tell us about your retail business</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Forecastify</h1>
          </div>

          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className={`h-2 rounded-full transition-all ${step === 1 ? "w-12 bg-primary" : "w-6 bg-muted"}`} />
            <div className={`h-2 rounded-full transition-all ${step === 2 ? "w-12 bg-primary" : "w-6 bg-muted"}`} />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {step === 1 ? "Create your account" : "Store Details"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {step === 1 ? "Enter your personal details to get started" : "Tell us about your retail store for a tailored experience"}
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm mb-5">{error}</div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5"><User className="w-4 h-4 inline mr-1.5" />Full Name *</label>
                <input type="text" value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} placeholder="John Doe" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5"><Mail className="w-4 h-4 inline mr-1.5" />Email Address *</label>
                <input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="you@yourstore.com" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5"><Phone className="w-4 h-4 inline mr-1.5" />Phone Number *</label>
                <input type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+91 9876543210" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => updateField("password", e.target.value)} placeholder="Min. 6 characters" required className={`${inputClass} pr-12`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password *</label>
                <input type="password" value={formData.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} placeholder="Re-enter your password" required className={inputClass} />
              </div>
              <button type="button" onClick={handleNext} className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mt-2">
                Continue to Store Details
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5"><Store className="w-4 h-4 inline mr-1.5" />Store Name *</label>
                <input type="text" value={formData.storeName} onChange={(e) => updateField("storeName", e.target.value)} placeholder="My Retail Store" required className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5"><ShoppingBag className="w-4 h-4 inline mr-1.5" />Store Category *</label>
                  <select value={formData.storeCategory} onChange={(e) => updateField("storeCategory", e.target.value)} required className={inputClass}>
                    <option value="">Select category</option>
                    {storeCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5"><Building2 className="w-4 h-4 inline mr-1.5" />Store Size *</label>
                  <select value={formData.storeSize} onChange={(e) => updateField("storeSize", e.target.value)} required className={inputClass}>
                    <option value="">Select size</option>
                    {storeSizes.map((size) => (<option key={size} value={size}>{size}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5"><MapPin className="w-4 h-4 inline mr-1.5" />Store Address</label>
                <input type="text" value={formData.storeAddress} onChange={(e) => updateField("storeAddress", e.target.value)} placeholder="123 Market Street" className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                  <input type="text" value={formData.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Mumbai" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                  <input type="text" value={formData.state} onChange={(e) => updateField("state", e.target.value)} placeholder="Maharashtra" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">PIN Code</label>
                  <input type="text" value={formData.pincode} onChange={(e) => updateField("pincode", e.target.value)} placeholder="400001" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">GST Number</label>
                  <input type="text" value={formData.gstNumber} onChange={(e) => updateField("gstNumber", e.target.value)} placeholder="22AAAAA0000A1Z5" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Number of Outlets</label>
                  <input type="number" min="1" value={formData.numberOfOutlets} onChange={(e) => updateField("numberOfOutlets", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:opacity-90 focus:outline-none">Back</button>
                <button type="submit" disabled={loading}
                  className="flex-[2] py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? (<><div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Creating Account...</>) : "Create Account"}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
