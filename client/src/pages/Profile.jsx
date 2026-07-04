import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  UploadCloud,
  UserRoundPen,
  Save,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') 
  : "http://localhost:5000";

function Profile() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [previewImage, setPreviewImage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const formatRole = {
    superadmin: "Super Admin",
    company_admin: "Company Admin",
    accountant: "Accountant",
    sales_user: "Sales User",
  };

  useEffect(() => {
    setFormData({
      name: user?.name || "",
      phone: user?.phone || "",
    });
  }, [user?.name, user?.phone]);

  const initials = useMemo(() => {
    const name = user?.name || formData.name || "U";

    return (
      name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  }, [user?.name, formData.name]);

  const profileImageUrl = useMemo(() => {
    if (!user?.profile_image) return "";

    if (user.profile_image.startsWith("http")) {
      return user.profile_image;
    }

    if (
      user.profile_image.startsWith("/uploads") ||
      user.profile_image.startsWith("/upload")
    ) {
      return `${BASE_URL}${user.profile_image}`;
    }

    return `${BASE_URL}/uploads/profiles/${user.profile_image}`;
  }, [user?.profile_image]);

  const visibleImage = previewImage || profileImageUrl;

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleProfileImageUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    const formDataPayload = new FormData();
    formDataPayload.append("profile_image", selectedFile);

    try {
      setUploading(true);

      const res = await api.patch("/users/profile-image", formDataPayload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser = {
        ...user,
        ...(res.data?.user || {}),
        profile_image:
          res.data?.profile_image ||
          res.data?.user?.profile_image ||
          user?.profile_image,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      setSelectedFile(null);
      setSelectedFileName("");
      setPreviewImage("");

      window.dispatchEvent(new Event("userUpdated"));
      toast.success("Profile image updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSaving(true);

      await api.patch("/users/profile", {
        name: formData.name.trim(),
        phone: formData.phone,
      });

      const updatedUser = {
        ...user,
        name: formData.name.trim(),
        phone: formData.phone,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      window.dispatchEvent(new Event("userUpdated"));
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!passwordData.currentPassword) {
      toast.error("Current password is required");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setChangingPassword(true);

      await api.patch("/auth/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleFormChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePasswordInputChange = (e) => {
    setPasswordData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              <UserRoundPen size={17} />
              Account Profile
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Profile
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Manage your personal account information, photo and password.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-300" />
            {formatRole[user?.role] || user?.role || "User"}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.85fr_1.15fr] lg:gap-0">
          <div className="border-slate-200 dark:border-slate-800 lg:border-r lg:pr-6">
            <SectionTitle
              icon={<Camera size={18} />}
              title="Profile Photo"
              description="Upload JPG, PNG or WEBP image up to 2MB."
            />

            <div className="flex flex-col items-center">
              <div className="relative">
                {visibleImage ? (
                  <img
                    src={visibleImage}
                    alt={user?.name || "User"}
                    className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg ring-1 ring-slate-200 dark:border-slate-800 dark:ring-slate-700"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-indigo-600 text-4xl font-bold text-white shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
                    {initials}
                  </div>
                )}

                <div className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow dark:border-slate-900">
                  <Camera size={16} />
                </div>
              </div>

              {previewImage && (
                <span className="mt-3 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Preview
                </span>
              )}

              <div className="mt-6 w-full max-w-sm space-y-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    Choose File
                  </span>

                  <span className="max-w-40 truncate text-sm font-medium text-slate-600 dark:text-slate-400">
                    {selectedFileName || "No file selected"}
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleProfileImageUpload}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UploadCloud size={18} />
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:pl-6">
            <SectionTitle
              icon={<UserRoundPen size={18} />}
              title="Profile Information"
              description="Your personal and account details."
            />

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <EditableField
                label="Full Name"
                name="name"
                icon={<UserRoundPen size={16} />}
                value={formData.name}
                onChange={handleFormChange}
              />

              <ReadOnlyField
                label="Email Address"
                icon={<Mail size={16} />}
                value={user?.email || ""}
              />

              <EditableField
                label="Phone Number"
                name="phone"
                icon={<Phone size={16} />}
                value={formData.phone}
                onChange={handleFormChange}
              />

              <ReadOnlyField
                label="Role"
                icon={<ShieldCheck size={16} />}
                value={formatRole[user?.role] || user?.role || ""}
              />

              {user?.branch_name && (
                <ReadOnlyField
                  label="Branch"
                  icon={<MapPin size={16} />}
                  value={user.branch_name || "N/A"}
                />
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <KeyRound size={21} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Change Password
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Update your account password securely.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <PasswordField
                label="Current Password"
                name="currentPassword"
                value={passwordData.currentPassword}
                visible={showPasswords.currentPassword}
                onToggle={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    currentPassword: !prev.currentPassword,
                  }))
                }
                onChange={handlePasswordInputChange}
              />

              <PasswordField
                label="New Password"
                name="newPassword"
                value={passwordData.newPassword}
                visible={showPasswords.newPassword}
                onToggle={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    newPassword: !prev.newPassword,
                  }))
                }
                onChange={handlePasswordInputChange}
              />

              <PasswordField
                label="Confirm Password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                visible={showPasswords.confirmPassword}
                onToggle={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    confirmPassword: !prev.confirmPassword,
                  }))
                }
                onChange={handlePasswordInputChange}
              />

              <button
                type="submit"
                disabled={changingPassword}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-slate-800 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                <Lock size={17} />
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, description }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
          {icon}
        </div>
      )}

      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, icon }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        {label}
      </label>

      <input
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none opacity-90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        value={value || ""}
        readOnly
      />
    </div>
  );
}

function EditableField({ label, name, value, onChange, icon }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        {label}
      </label>

      <input
        name={name}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/50"
        value={value || ""}
        onChange={onChange}
      />
    </div>
  );
}

function PasswordField({
  label,
  name,
  value,
  visible,
  onToggle,
  onChange,
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">
          <Lock size={16} />
        </span>
        {label}
      </label>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/50"
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default Profile;