#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <BH1750.h>
#include "config.h"

constexpr uint8_t DHT_PIN=4, FAN_PIN=25, LIGHT_PIN=26;
WiFiClient network;
PubSubClient mqtt(network);
DHT dht(DHT_PIN,DHT_TYPE);
BH1750 lightMeter;
bool fanOn=false,lightOn=false,lightReady=false;
unsigned long lastRead=0,lastMqttTry=0,lastWifiTry=0;
struct Ack { String actionId; int deviceId=0; bool on=false; };
Ack recent[8];uint8_t nextAck=0;

void publishState(int deviceId,const String &actionId="",bool overrideState=false,bool state=false){
  JsonDocument body;body["deviceId"]=deviceId;
  bool on=overrideState?state:(deviceId==1?fanOn:lightOn);
  body["status"]=on?"on":"off";
  if(actionId.length())body["actionId"]=actionId;
  char payload[192],topic[64];serializeJson(body,payload,sizeof(payload));
  snprintf(topic,sizeof(topic),"iot/devices/%d/status",deviceId);
  // ACK is always non-retained. The backend correlates it with the pending actionId.
  if(!mqtt.publish(topic,payload,false))Serial.println("ACK/status publish failed");
}
void callback(char *topic,byte *payload,unsigned int length){
  JsonDocument body;if(deserializeJson(body,payload,length))return;
  int id=body["deviceId"]|0;String action=body["action"]|"";String actionId=body["actionId"]|"";
  char expected[64];snprintf(expected,sizeof(expected),"iot/devices/%d/command",id);
  if((id!=1&&id!=2)||strcmp(topic,expected)!=0||(action!="ON"&&action!="OFF")||actionId.length()<2||actionId.length()>24||actionId[0]!='A')return;
  for(unsigned int i=1;i<actionId.length();i++)if(!isDigit(actionId[i]))return;
  for(const Ack &ack:recent)if(ack.actionId==actionId&&ack.deviceId==id){publishState(id,actionId,true,ack.on);return;}
  bool on=action=="ON";
  digitalWrite(id==1?FAN_PIN:LIGHT_PIN,on?HIGH:LOW);
  if(id==1)fanOn=on;else lightOn=on;
  recent[nextAck]={actionId,id,on};nextAck=(nextAck+1)%8;
  publishState(id,actionId);
  Serial.printf("Applied %s to device %d (%s)\n",action.c_str(),id,actionId.c_str());
}
void connectMqtt(){
  String clientId="smartroom-"+WiFi.macAddress();
  if(!mqtt.connect(clientId.c_str(),MQTT_USERNAME,MQTT_PASSWORD,"iot/esp32/status",1,true,"offline")){Serial.printf("MQTT error: %d\n",mqtt.state());return;}
  mqtt.subscribe("iot/devices/1/command",1);mqtt.subscribe("iot/devices/2/command",1);
  mqtt.publish("iot/esp32/status","online",true);publishState(1);publishState(2);
  Serial.println("MQTT ready; numeric device topics, JSON actionId commands.");
}
void readSensors(){
  JsonDocument body;float t=dht.readTemperature(),h=dht.readHumidity();
  if(!isnan(t))body["temperature"]=t;
  if(!isnan(h))body["humidity"]=h;
  if(lightReady){float lux=lightMeter.readLightLevel();if(lux>=0){body["light"]=lux;body["lightUnit"]="lux";}}
  char payload[256];serializeJson(body,payload,sizeof(payload));Serial.println(payload);
  if(mqtt.connected()){mqtt.publish("iot/sensors/data",payload,false);mqtt.publish("iot/esp32/status","online",true);publishState(1);publishState(2);}
}
void setup(){
  Serial.begin(115200);pinMode(FAN_PIN,OUTPUT);pinMode(LIGHT_PIN,OUTPUT);digitalWrite(FAN_PIN,LOW);digitalWrite(LIGHT_PIN,LOW);
  dht.begin();Wire.begin(21,22);lightReady=lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if(!lightReady)Serial.println("BH1750 unavailable. Check I2C SDA21/SCL22 and address 0x23.");
  mqtt.setServer(MQTT_HOST,MQTT_PORT);mqtt.setCallback(callback);mqtt.setBufferSize(1024);mqtt.setKeepAlive(15);mqtt.setSocketTimeout(2);
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
}
void loop(){
  unsigned long now=millis();
  if(WiFi.status()!=WL_CONNECTED){if(now-lastWifiTry>15000){lastWifiTry=now;WiFi.reconnect();}}
  else {if(!mqtt.connected()&&now-lastMqttTry>5000){lastMqttTry=now;connectMqtt();}if(mqtt.connected())mqtt.loop();}
  if(now-lastRead>=3000){lastRead=now;readSensors();}delay(2);
}
