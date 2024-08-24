// xrSetup.test.js

import { setupXR } from '../public/js/xrSetup';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';

jest.mock('three/examples/jsm/webxr/VRButton');
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory');

describe
