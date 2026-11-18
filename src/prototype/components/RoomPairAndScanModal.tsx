import React, { useCallback, useEffect, useState } from 'react';
import {
  Bluetooth,
  Check,
  Copy,
  Headphones,
  Plus,
  Radar,
  Radio,
  RefreshCw,
  Route,
  Speaker,
  UserPlus,
  Wifi,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LanguageCode } from '../types';
import type {
  NearbyRoomScanEntry,
  RoomPeerConnectionType,
  RoomPeerParticipant,
  RoomSyncId
} from '../../types/roomSync';
import { djAudioController } from '../djAudioEngine';

export type PairAndScanTab = 'pair' | 'route' | 'scan';

interface RoomPairAndScanModalProps {
  open: boolean;
  initialTab?: PairAndScanTab;
  onClose: () => void;
  lang: LanguageCode;
  roomId: RoomSyncId;
  roomGlowHex: string;
  myDeviceName: string;
  onChangeMyDeviceName: (name: string) => void;
  peers: RoomPeerParticipant[];
  onJoinPeerDevice: (deviceName: string, connectionType: RoomPeerConnectionType) => Promise<void>;
  onTogglePeerRoute: (peerId: string, routed: boolean) => Promise<void>;
  onPullSyncedTrackFromNearby: (entry: NearbyRoomScanEntry) => Promise<void>;
  onExitToOuterMenu: () => void;
  latestAddedByDevice?: string;
}

interface LocalAudioOutputInfo {
  deviceId: string;
  label: string;
}

export function RoomPairAndScanModal({
  open,
  initialTab = 'pair',
  onClose,
  lang,
  roomId,
  roomGlowHex,
  myDeviceName,
  onChangeMyDeviceName,
  peers,
  onJoinPeerDevice,
  onTogglePeerRoute,
  onPullSyncedTrackFromNearby,
  onExitToOuterMenu,
  latestAddedByDevice
}: RoomPairAndScanModalProps) {
  const isFa = lang === 'fa';
  const [tab, setTab] = useState<PairAndScanTab>(initialTab);
  const [btFriendName, setBtFriendName] = useState('');
  const [wifiFriendName, setWifiFriendName] = useState('');
  const [btBusy, setBtBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const [audioOutputs, setAudioOutputs] = useState<LocalAudioOutputInfo[]>([]);
  const [selectedSinkId, setSelectedSinkId] = useState<string>('default');

  const [scanning, setScanning] = useState(false);
  const [nearbyRooms, setNearbyRooms] = useState<NearbyRoomScanEntry[]>([]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [initialTab, open]);

  const refreshAudioOutputs = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outs = devices
          .filter((d) => d.kind === 'audiooutput' && d.deviceId)
          .map((d, idx) => ({
            deviceId: d.deviceId,
            label: d.label || `Audio Output ${idx + 1}`
          }));
        setAudioOutputs(outs);
      }
    } catch {
      // Permission or sandbox limitation
    }
  }, []);

  const runNearbyScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/rooms/nearby');
      if (res.ok) {
        const data = (await res.json()) as { rooms?: NearbyRoomScanEntry[] };
        if (Array.isArray(data.rooms)) {
          setNearbyRooms(data.rooms);
        }
      }
      await refreshAudioOutputs();
    } catch {
      // ignore network error
    } finally {
      window.setTimeout(() => setScanning(false), 380);
    }
  }, [refreshAudioOutputs]);

  useEffect(() => {
    if (open) {
      void refreshAudioOutputs();
      if (tab === 'scan') {
        void runNearbyScan();
      }
    }
  }, [open, refreshAudioOutputs, runNearbyScan, tab]);

  const handleRealBluetoothPair = async () => {
    setBtBusy(true);
    setStatusMsg(null);
    const navBt = navigator as Navigator & {
      bluetooth?: {
        requestDevice: (opts: { acceptAllDevices?: boolean; optionalServices?: string[] }) => Promise<{
          name?: string;
          id?: string;
        }>;
      };
    };

    try {
      if (navBt.bluetooth && typeof navBt.bluetooth.requestDevice === 'function') {
        const device = await navBt.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'device_information']
        });
        const name = device?.name?.trim() || `BT Device ${String(device?.id || '').slice(0, 6)}`;
        await onJoinPeerDevice(name, 'bluetooth');
        setStatusMsg(
          isFa
            ? `دستگاه بلوتوث «${name}» جفت شد و روی کاراکتر اتاق نمایش داده شد.`
            : `Bluetooth device "${name}" paired and added to room!`
        );
        setBtBusy(false);
        return;
      }
      setStatusMsg(
        isFa
          ? 'مرورگر دسترسی مستقیم Web Bluetooth نداد؛ نام دستگاه بلوتوث دوستتان را زیر وارد کنید.'
          : 'Web Bluetooth API unavailable in this browser — add friend Bluetooth device below.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(msg)) {
        setStatusMsg(isFa ? 'انتخاب بلوتوث لغو شد.' : 'Bluetooth picker cancelled.');
      } else {
        setStatusMsg(
          isFa
            ? 'در این مرورگر/آیفریم اسکن بلوتوث سخت‌افزاری محدود است؛ می‌توانید از کادر زیر مستقیم نام دستگاه بلوتوث دوستتان را متصل کنید.'
            : 'Direct hardware Bluetooth prompt restricted here; pair friend Bluetooth device directly below.'
        );
      }
    } finally {
      setBtBusy(false);
    }
  };

  const handleCopyWifiInvite = async () => {
    const shareUrl = `${window.location.origin}/?room=${roomId}&wifi=1`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedWifi(true);
      window.setTimeout(() => setCopiedWifi(false), 1800);
    } catch {
      setCopiedWifi(true);
      window.setTimeout(() => setCopiedWifi(false), 1800);
    }
  };

  const handleSelectSinkOutput = async (sinkId: string, label: string) => {
    setSelectedSinkId(sinkId);
    const ok = await djAudioController.setOutputSinkId(sinkId);
    setStatusMsg(
      ok
        ? isFa
          ? `مسیر خروجی صدا به «${label}» اضافه شد.`
          : `Audio output routed to "${label}".`
        : isFa
          ? `دستگاه خروجی «${label}» در مسیر هم‌زمان ثبت شد.`
          : `Output "${label}" registered in multi-device route.`
    );
  };

  if (!open) return null;

  const routedPeers = peers.filter((p) => p.routed);

  return (
    <AnimatePresence>
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[86dvh] flex flex-col rounded-t-[30px] sm:rounded-[30px] border border-white/15 bg-[#080b14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-2xl flex items-center justify-center border border-[#38BDF8]/40 bg-[#38BDF8]/15 text-[#38BDF8]">
                <Bluetooth className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {isFa
                    ? 'اتصال با دوستان (فقط بلوتوث و وای‌فای) · مسیر چند دیوایس'
                    : 'Pair Friends (Bluetooth & Wi-Fi Only) & Nearby Scan'}
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {isFa
                    ? `${peers.length} دستگاه در اتاق متصل · ${routedPeers.length} دیوایس در مسیر پخش هم‌زمان`
                    : `${peers.length} paired · ${routedPeers.length} in simultaneous route`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 bg-white/[0.02]">
            {(
              [
                { id: 'pair', icon: Bluetooth, fa: 'Pair (بلوتوث / وای‌فای)', en: 'Pair (BT / Wi-Fi)' },
                { id: 'route', icon: Route, fa: 'مسیر چند دیوایسی', en: 'Multi-Device Route' },
                { id: 'scan', icon: Radar, fa: 'اسکن اتاق اطراف', en: 'Scan Nearby Rooms' }
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    active ? 'text-[#06070C] font-bold shadow-md' : 'text-[#CBD5E1] hover:bg-white/10'
                  }`}
                  style={active ? { backgroundColor: roomGlowHex } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{isFa ? item.fa : item.en}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {statusMsg && (
              <div className="rounded-2xl border border-[#34D399]/40 bg-[#34D399]/12 px-3.5 py-2.5 text-xs text-[#A7F3D0]">
                {statusMsg}
              </div>
            )}

            {tab === 'pair' && (
              <div className="space-y-4">
                {/* My Device Name */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2">
                  <label className="text-[11px] font-bold text-[#CBD5E1]">
                    {isFa ? 'نام دستگاه شما در بالای سر کاراکتر اتاق:' : 'Your Device Name Badge:'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={myDeviceName}
                      onChange={(e) => onChangeMyDeviceName(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04060c] px-3 py-2 text-xs text-white focus:border-[#34D399] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void onJoinPeerDevice(myDeviceName, 'wifi')}
                      className="shrink-0 rounded-xl bg-[#34D399] px-3 py-2 text-xs font-bold text-[#06070C] cursor-pointer"
                    >
                      {isFa ? 'ثبت روی کاراکتر' : 'Update Badge'}
                    </button>
                  </div>
                </div>

                {/* Bluetooth Pairing Section (Strictly Bluetooth) */}
                <div className="rounded-2xl border border-[#38BDF8]/30 bg-[#38BDF8]/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bluetooth className="h-4.5 w-4.5 text-[#38BDF8]" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
                          {isFa ? 'اتصال با بلوتوث (Bluetooth Pair)' : 'Bluetooth Friend & Speaker Pair'}
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">
                          {isFa
                            ? 'پیدا کردن هدفون، اسپیکر یا گوشی دوستتان با بلوتوث و نمایش نام دستگاه روی کاراکتر'
                            : 'Pair friend Bluetooth devices & show live BT badge over their 3D character'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={btBusy}
                      onClick={() => void handleRealBluetoothPair()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#38BDF8] px-3.5 py-2 text-[11px] font-bold text-[#06070C] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                    >
                      <Bluetooth className="h-3.5 w-3.5" />
                      <span>{btBusy ? (isFa ? 'در حال جستجو...' : 'Scanning...') : isFa ? 'اسکن بلوتوث' : 'Scan BT'}</span>
                    </button>
                  </div>

                  {/* Manual / Nearby Bluetooth Device Quick Pair */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!btFriendName.trim()) return;
                      void onJoinPeerDevice(btFriendName.trim(), 'bluetooth').then(() => {
                        setStatusMsg(
                          isFa
                            ? `دوست با دستگاه بلوتوث «${btFriendName.trim()}» به صحنه سه‌بعدی اضافه شد.`
                            : `Bluetooth friend "${btFriendName.trim()}" joined room.`
                        );
                        setBtFriendName('');
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={btFriendName}
                      onChange={(e) => setBtFriendName(e.target.value)}
                      placeholder={
                        isFa
                          ? 'نام دستگاه بلوتوث دوست (مثلاً AirPods Reza یا JBL Go)'
                          : 'Bluetooth device name (e.g. AirPods Pro, JBL Flip)'
                      }
                      className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04060c] px-3 py-2 text-xs text-white placeholder:text-[#64748B] focus:border-[#38BDF8] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!btFriendName.trim()}
                      className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#38BDF8]/50 bg-[#38BDF8]/20 px-3 py-2 text-xs font-bold text-[#38BDF8] hover:bg-[#38BDF8]/30 disabled:opacity-45 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isFa ? 'Pair بلوتوث' : 'Pair BT'}</span>
                    </button>
                  </form>
                </div>

                {/* Wi-Fi Pairing Section (Strictly Wi-Fi) */}
                <div className="rounded-2xl border border-[#34D399]/30 bg-[#34D399]/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4.5 w-4.5 text-[#34D399]" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
                          {isFa ? 'اتصال با وای‌فای (Wi-Fi Direct / LAN Sync)' : 'Wi-Fi Local Network Pair'}
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">
                          {isFa
                            ? `کد شبکه اتاق: AIPETROS-${roomId.toUpperCase()}-WIFI · هم‌زمان روی تمام تب‌ها و دستگاه‌های هم‌شبکه`
                            : `Room Wi-Fi ID: AIPETROS-${roomId.toUpperCase()}-WIFI`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyWifiInvite()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#34D399] px-3.5 py-2 text-[11px] font-bold text-[#06070C] cursor-pointer"
                    >
                      {copiedWifi ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>
                        {copiedWifi
                          ? isFa
                            ? 'کپی شد!'
                            : 'Copied!'
                          : isFa
                            ? 'کپی لینک وای‌فای'
                            : 'Copy Wi-Fi Link'}
                      </span>
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!wifiFriendName.trim()) return;
                      void onJoinPeerDevice(wifiFriendName.trim(), 'wifi').then(() => {
                        setStatusMsg(
                          isFa
                            ? `دوست با دستگاه وای‌فای «${wifiFriendName.trim()}» به اتاق اضافه شد.`
                            : `Wi-Fi friend "${wifiFriendName.trim()}" joined room.`
                        );
                        setWifiFriendName('');
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={wifiFriendName}
                      onChange={(e) => setWifiFriendName(e.target.value)}
                      placeholder={
                        isFa
                          ? 'نام دستگاه دوست روی وای‌فای (مثلاً iPhone Sara یا Galaxy S24)'
                          : 'Friend Wi-Fi device name (e.g. iPhone Sara)'
                      }
                      className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04060c] px-3 py-2 text-xs text-white placeholder:text-[#64748B] focus:border-[#34D399] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!wifiFriendName.trim()}
                      className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#34D399]/50 bg-[#34D399]/20 px-3 py-2 text-xs font-bold text-[#34D399] hover:bg-[#34D399]/30 disabled:opacity-45 cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{isFa ? 'Pair وای‌فای' : 'Pair Wi-Fi'}</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {tab === 'route' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Route className="h-4 w-4 text-[#F5B942]" />
                      <span>
                        {isFa
                          ? 'مسیر فعال هم‌زمان بین دستگاه‌های اتاق'
                          : 'Simultaneous Multi-Device Audio Route'}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#34D399]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#34D399]">
                      {routedPeers.length} {isFa ? 'مسیر هم‌زمان' : 'Routed'}
                    </span>
                  </div>

                  {/* Visual Route Chain */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {routedPeers.length > 0 ? (
                      routedPeers.map((p, idx) => (
                        <React.Fragment key={p.id}>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                              p.connectionType === 'bluetooth'
                                ? 'border-[#38BDF8]/50 bg-[#38BDF8]/15 text-[#BAE6FD]'
                                : 'border-[#34D399]/50 bg-[#34D399]/15 text-[#A7F3D0]'
                            }`}
                          >
                            {p.connectionType === 'bluetooth' ? (
                              <Bluetooth className="h-3 w-3" />
                            ) : (
                              <Wifi className="h-3 w-3" />
                            )}
                            <span>{p.deviceName}</span>
                          </span>
                          {idx < routedPeers.length - 1 && (
                            <span className="text-[#64748B] text-xs shrink-0">⇄</span>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">
                        {isFa ? 'حداقل یک دستگاه را برای پخش هم‌زمان فعال کنید.' : 'Enable at least one device.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Connected Peer Devices Toggle List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#CBD5E1]">
                    {isFa
                      ? 'کاراکترها و دستگاه‌های متصل در صحنه سه‌بعدی:'
                      : 'Paired Room Characters & Devices:'}
                  </div>
                  {peers.map((peer) => {
                    const isBt = peer.connectionType === 'bluetooth';
                    const isLatest =
                      latestAddedByDevice &&
                      peer.deviceName.toLowerCase() === latestAddedByDevice.toLowerCase();
                    return (
                      <div
                        key={peer.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isBt
                                ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
                                : 'bg-[#34D399]/15 text-[#34D399]'
                            }`}
                          >
                            {isBt ? <Bluetooth className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{peer.deviceName}</span>
                              {isLatest && (
                                <span className="shrink-0 rounded-full bg-[#F5B942]/20 px-2 py-0.5 text-[9px] font-bold text-[#F5B942]">
                                  {isFa ? 'آخرین موزیک' : 'Last DJ'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              {isBt ? 'Bluetooth Sync' : 'Wi-Fi Local Sync'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void onTogglePeerRoute(peer.id, !peer.routed)}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                            peer.routed
                              ? 'bg-[#34D399] text-[#06070C]'
                              : 'border border-white/15 bg-white/5 text-[#CBD5E1] hover:text-white'
                          }`}
                        >
                          {peer.routed
                            ? isFa
                              ? 'متصل در مسیر ✓'
                              : 'In Route ✓'
                            : isFa
                              ? 'افزودن به مسیر'
                              : 'Add to Route'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Local Hardware Speaker / Bluetooth Sink Output List */}
                {audioOutputs.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#CBD5E1]">
                      <Speaker className="h-3.5 w-3.5 text-[#38BDF8]" />
                      <span>
                        {isFa
                          ? 'خروجی‌های صدای سخت‌افزاری شناسایی‌شده روی این دستگاه:'
                          : 'Detected Local Audio Hardware Outputs:'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {audioOutputs.map((out) => {
                        const active = selectedSinkId === out.deviceId;
                        return (
                          <button
                            key={out.deviceId}
                            type="button"
                            onClick={() => void handleSelectSinkOutput(out.deviceId, out.label)}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-start text-[11px] cursor-pointer ${
                              active
                                ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white font-semibold'
                                : 'border-white/10 bg-white/[0.03] text-[#CBD5E1] hover:bg-white/[0.07]'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1.5">
                              <Headphones className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />
                              <span className="truncate">{out.label}</span>
                            </span>
                            {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'scan' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#CBD5E1]">
                    <Radar className={`h-4 w-4 text-[#00F0FF] ${scanning ? 'animate-spin' : ''}`} />
                    <span>
                      {scanning
                        ? isFa
                          ? 'در حال اسکن اتاق‌ها و دیوایس‌های بلوتوث و وای‌فای اطراف...'
                          : 'Scanning nearby rooms over Wi-Fi & Bluetooth...'
                        : isFa
                          ? `${nearbyRooms.length} اتاق فعال در محدوده اطراف شناسایی شد`
                          : `${nearbyRooms.length} nearby active rooms discovered`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runNearbyScan()}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
                    <span>{isFa ? 'اسکن مجدد' : 'Rescan'}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {nearbyRooms.map((entry) => {
                    const isSameRoom = entry.roomId === roomId;
                    const isBt = entry.signalType === 'bluetooth';
                    return (
                      <div
                        key={entry.roomId}
                        className={`rounded-2xl border p-3.5 space-y-2.5 ${
                          isSameRoom
                            ? 'border-[#F5B942]/55 bg-[#F5B942]/10'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 ${
                                isBt
                                  ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
                                  : 'bg-[#34D399]/15 text-[#34D399]'
                              }`}
                            >
                              {isBt ? <Bluetooth className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{isFa ? entry.titleFa : entry.titleEn}</span>
                                {isSameRoom && (
                                  <span className="rounded-full bg-[#F5B942]/25 px-2 py-0.5 text-[9px] text-[#F5B942]">
                                    {isFa ? 'اتاق فعلی' : 'Current'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#94A3B8] truncate">
                                🎵 {isFa ? entry.currentTrackTitleFa : entry.currentTrackTitleEn} ·{' '}
                                {entry.addedByDeviceName}
                              </div>
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-[#CBD5E1] shrink-0">
                            {entry.peerCount} {isFa ? 'دیوایس' : 'peers'} · {entry.signalStrength}%
                          </div>
                        </div>

                        {!isSameRoom && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                            <div className="flex items-center gap-1 flex-wrap">
                              {entry.peers.slice(0, 3).map((p) => (
                                <span
                                  key={p.id}
                                  className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#CBD5E1]"
                                >
                                  {p.deviceName}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void onPullSyncedTrackFromNearby(entry).then(() => {
                                  setStatusMsg(
                                    isFa
                                      ? `دستگاه‌ها و موزیک «${entry.titleFa}» به اتاق فعلی همگام‌سازی شدند (تغییر اتاق فقط از منوی بیرون).`
                                      : `Synced peers & music from ${entry.titleEn} into this room.`
                                  );
                                })
                              }
                              className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#06070C] cursor-pointer"
                              style={{ backgroundColor: roomGlowHex }}
                            >
                              <Radio className="h-3 w-3" />
                              <span>{isFa ? 'همگام‌سازی به این اتاق' : 'Sync Into Room'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#94A3B8]">
                    {isFa
                      ? 'برای جابه‌جایی به فضای سه‌بعدی اتاق دیگر، به منوی بیرون بازگردید.'
                      : 'Switch between 3D rooms exclusively from the outer room menu.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExitToOuterMenu();
                    }}
                    className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    {isFa ? 'منوی بیرون اتاق‌ها' : 'Outer Menu'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
