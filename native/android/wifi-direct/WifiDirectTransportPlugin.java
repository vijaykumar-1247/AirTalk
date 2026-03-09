package com.airtalk.wifidirect;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Scaffold-only plugin.
 * Copy this class into android/app/src/main/java/... after running `npx cap add android`.
 */
@CapacitorPlugin(name = "WifiDirectTransport")
public class WifiDirectTransportPlugin extends Plugin {
  private final ConcurrentHashMap<String, JSObject> peers = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Boolean> connectedPeers = new ConcurrentHashMap<>();
  private String advertisingPayload = "AIRTALK#DEMO#00000#AVATAR_01";

  @PluginMethod
  public void startAdvertising(PluginCall call) {
    advertisingPayload = call.getString("payload", advertisingPayload);

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("payload", advertisingPayload);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopAdvertising(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void startDiscovery(PluginCall call) {
    JSObject simulatedPeer = new JSObject();
    simulatedPeer.put("peerId", "peer-demo-01");
    simulatedPeer.put("deviceName", advertisingPayload);
    simulatedPeer.put("deviceAddress", "02:00:00:00:00:01");
    simulatedPeer.put("broadcastPayload", advertisingPayload);
    simulatedPeer.put("signalStrength", getSimulatedSignalStrength());
    simulatedPeer.put("rangeMeters", getSimulatedRangeMeters());
    simulatedPeer.put("status", "available");
    peers.put("peer-demo-01", simulatedPeer);

    JSObject payload = new JSObject();
    payload.put("peers", new JSArray(peers.values().toArray()));
    notifyListeners("peersUpdated", payload);

    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopDiscovery(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void getDiscoveredPeers(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("peers", new JSArray(peers.values().toArray()));
    call.resolve(ret);
  }

  @PluginMethod
  public void connectKnownPeers(PluginCall call) {
    JSArray peerIds = call.getArray("peerIds", new JSArray());
    JSArray connected = new JSArray();

    for (int i = 0; i < peerIds.length(); i++) {
      String peerId = peerIds.optString(i, "");
      if (peerId.isEmpty()) continue;
      connectedPeers.put(peerId, true);
      connected.put(peerId);

      JSObject statusPayload = new JSObject();
      statusPayload.put("peerId", peerId);
      statusPayload.put("status", "connected");
      notifyListeners("peerConnectionStateChanged", statusPayload);
    }

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("connectedPeerIds", connected);
    call.resolve(ret);
  }

  @PluginMethod
  public void connectToPeer(PluginCall call) {
    String peerId = call.getString("peerId");
    boolean ok = peerId != null && !peerId.isEmpty();

    if (ok) {
      connectedPeers.put(peerId, true);
      JSObject statusPayload = new JSObject();
      statusPayload.put("peerId", peerId);
      statusPayload.put("status", "connected");
      notifyListeners("peerConnectionStateChanged", statusPayload);
    }

    JSObject ret = new JSObject();
    ret.put("ok", ok);
    ret.put("peerId", peerId);
    call.resolve(ret);
  }

  @PluginMethod
  public void disconnectPeer(PluginCall call) {
    String peerId = call.getString("peerId");
    if (peerId != null && !peerId.isEmpty()) {
      connectedPeers.remove(peerId);
      JSObject statusPayload = new JSObject();
      statusPayload.put("peerId", peerId);
      statusPayload.put("status", "disconnected");
      notifyListeners("peerConnectionStateChanged", statusPayload);
    }

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("peerId", peerId);
    call.resolve(ret);
  }

  @PluginMethod
  public void sendMessage(PluginCall call) {
    String peerId = call.getString("peerId");
    String text = call.getString("text");

    JSObject echo = new JSObject();
    echo.put("fromPeerId", peerId);
    echo.put("text", text);
    echo.put("attachmentBase64", call.getString("attachmentBase64"));
    echo.put("attachmentName", call.getString("attachmentName"));
    echo.put("mimeType", call.getString("mimeType"));
    echo.put("receivedAt", String.valueOf(System.currentTimeMillis()));
    notifyListeners("messageReceived", echo);

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("messageId", "msg-" + System.currentTimeMillis());
    call.resolve(ret);
  }

  @PluginMethod
  public void initiateCall(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("peerId", call.getString("peerId"));
    ret.put("mode", call.getString("mode", "voice"));
    call.resolve(ret);
  }

  @PluginMethod
  public void endCall(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void setMute(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("muted", call.getBoolean("muted", false));
    call.resolve(ret);
  }

  @PluginMethod
  public void setSpeaker(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("speakerOn", call.getBoolean("speakerOn", true));
    call.resolve(ret);
  }

  @PluginMethod
  public void setVideo(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("videoEnabled", call.getBoolean("videoEnabled", true));
    call.resolve(ret);
  }

  private int getSimulatedSignalStrength() {
    return -35 - (int) (Math.random() * 40);
  }

  private int getSimulatedRangeMeters() {
    return 3 + (int) (Math.random() * 28);
  }
}
