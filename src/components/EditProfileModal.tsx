import React, { useState } from 'react';
import { UserAccount, Language } from '../types';
import { saveUserAccountInCloud } from '../lib/firebase';
import { compressAndResizeImage } from '../utils/imageUtils';
import { X, Camera, User, Store, Phone, Check, Upload, Trash2 } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  language: Language;
  onSaveSuccess?: (updatedUser: UserAccount) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  language,
  onSaveSuccess,
}) => {
  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username || '');
  const [storeNameKh, setStoreNameKh] = useState(currentUser.storeNameKh || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressAndResizeImage(file, {
        maxDimension: 300,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setAvatarUrl(compressedDataUrl);
    } catch (err) {
      console.error('Failed to resize profile avatar photo:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedUser: UserAccount = {
      ...currentUser,
      fullName: fullName.trim() || currentUser.username,
      storeNameKh: storeNameKh.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUrl,
    };

    try {
      await saveUserAccountInCloud(updatedUser);
      if (onSaveSuccess) {
        onSaveSuccess(updatedUser);
      }
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setIsSaving(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200/80">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black text-slate-900 font-khmer">
              {language === 'km' ? 'កែសម្រួលព័ត៌មានគណនី (Edit Profile)' : 'Edit Profile'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-amber-400 shadow-md overflow-hidden bg-slate-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-3xl uppercase">
                    {currentUser.username.substring(0, 2)}
                  </div>
                )}
              </div>

              {/* Upload Button overlay */}
              <label className="absolute bottom-0 right-0 p-2 bg-slate-900 hover:bg-amber-500 text-white hover:text-slate-950 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-105 border-2 border-white">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 cursor-pointer transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'km' ? 'ជ្រើសរើសរូបថត (Upload Photo)' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors"
                  title={language === 'km' ? 'លុបរូបថត' : 'Remove Photo'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Input Fields */}
          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-khmer">
                {language === 'km' ? 'ឈ្មោះបង្ហាញ (Profile Name)' : 'Profile Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={language === 'km' ? 'បញ្ចូលឈ្មោះរបស់អ្នក...' : 'Enter your profile name...'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-khmer">
                {language === 'km' ? 'ឈ្មោះហាង (Store Name)' : 'Store Name'}
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={storeNameKh}
                  onChange={(e) => setStoreNameKh(e.target.value)}
                  placeholder={language === 'km' ? 'បញ្ចូលឈ្មោះហាង...' : 'Enter store name...'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-khmer">
                {language === 'km' ? 'លេខទូរស័ព្ទ (Phone Number)' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={language === 'km' ? 'បញ្ចូលលេខទូរស័ព្ទ...' : 'Enter phone number...'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {language === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>{language === 'km' ? 'បានរក្សាទុក!' : 'Saved!'}</span>
                </>
              ) : (
                <span>{language === 'km' ? 'រក្សាទុកការផ្លាស់ប្តូរ' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
