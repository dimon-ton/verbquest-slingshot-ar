import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';

const WASM_ROOT='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
let landmarker:HandLandmarker|undefined;

const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Hand tracking failed unexpectedly.';

self.onmessage=async(event:MessageEvent<{type:'init'}|{type:'frame';frame:ImageBitmap;timestamp:number}>)=>{
  const message=event.data;
  if(message.type==='init'){
    try{
      const vision=await FilesetResolver.forVisionTasks(WASM_ROOT);
      const options={baseOptions:{modelAssetPath:MODEL_URL,delegate:'GPU' as const},runningMode:'VIDEO' as const,numHands:1,minHandDetectionConfidence:.4,minHandPresenceConfidence:.4,minTrackingConfidence:.4};
      try{landmarker=await HandLandmarker.createFromOptions(vision,options);}
      catch{landmarker=await HandLandmarker.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:MODEL_URL,delegate:'CPU'}});}
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:errorMessage(error)});}
    return;
  }
  try{
    if(!landmarker)throw Error('Hand tracking is not ready.');
    const result=landmarker.detectForVideo(message.frame,message.timestamp);
    const landmarks=result.landmarks.map(hand=>hand.map(({x,y})=>({x,y})));
    self.postMessage({type:'result',landmarks});
  }catch(error){self.postMessage({type:'error',message:errorMessage(error)});}
  finally{message.frame.close();}
};
