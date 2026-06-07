export const shortenWallet = (address) => {
  if (!address || typeof address !== 'string') return '';
  if (!address.startsWith('0x') && address.length < 10) return address; // Fallback if not an ETH address
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getDisplayName = (user) => {
  if (!user) return "Guest User";
  if (user.full_name && user.full_name.trim() !== '') return user.full_name;
  if (user.fullName && user.fullName.trim() !== '') return user.fullName; // Handle camelCase variant
  if (user.username && !user.username.startsWith('0x')) return user.username;
  if (user.email && user.email.trim() !== '') return user.email;
  if (user.ensName) return user.ensName; // Optional ENS support
  
  if (user.walletAddress || user.wallet_address) {
    return shortenWallet(user.walletAddress || user.wallet_address);
  }
  
  return "Guest User";
};

export const getAvatarInitials = (user) => {
  const name = getDisplayName(user);
  if (name === "Guest User" || name.startsWith('0x')) return "?";
  
  // Extract initials (up to 2 letters)
  const parts = name.split(/[\s_.-]+/);
  let initials = '';
  if (parts.length >= 2) {
    initials = `${parts[0].charAt(0)}${parts[1].charAt(0)}`;
  } else {
    initials = name.slice(0, 2);
  }
  return initials.toUpperCase();
};
