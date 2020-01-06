THREE.MetaBalls = function(envMap, camera, blobs, maxBlobs, rect) {
	var texture = new THREE.Texture();
	var raymarch = `
		uniform int numBlobs, steps;
		uniform vec3 blobs[maxBlobs], blobs1[maxBlobs];
		uniform float blobs2[maxBlobs];
		uniform float test, k;
		varying vec3 vNear, vFar, vPoint;
		vec3 point;
		int n;

		float capsule(vec3 pa, vec3 ba, float ba2) {
		    float h = clamp( dot(pa,ba)/ba2, 0.0, 1.0 );
		    return length( pa - ba*h );
		}

		float world(in vec3 at, in float maxL, in float maxL2) {
			float sum = 0.;
			for (int i = 0; i < maxBlobs; ++i) {
				if (i==numBlobs) break;
				sum += exp(-k*capsule(-at+blobs[i], blobs1[i], blobs2[i]));
			}
			return -log(sum)/k;
		}

		vec3 raymarch(in vec3 pos, in vec3 dir, in float maxL, in float maxL2) {
			float l = 0., d=maxL, d0;
			for (int i = 0; i < 128; ++i) {
				d0=d;
				d = world(pos + dir * l, maxL, maxL2);
				l += d;
				if ( abs(d)<.5 || i==steps) break;
				n=i;
				if (l > maxL) {l = 0.; break;}
			}
			#ifdef ISFRAG
			 if (d>0. && d>d0) discard;
			#endif
			return vec3(pos + dir * l);
		}`;

	var material = new THREE.ShaderMaterial({
		transparent: true,
		defines: {
			maxBlobs: maxBlobs
		},
		uniforms: {
			envMap: {value: envMap},
			blobs: {value: blobs[0]},
			blobs1: {value: blobs[1]},
			blobs2: {value: blobs[2]},
			numBlobs: {value: 6},
			invMatrix: {value: new THREE.Matrix4()},
			stepsFrag: {value: 64},
			stepsVert: {value: 20},
			test: {value: 20},
			k: {value: .022}
		},
		vertexShader: `
		uniform mat4 invMatrix;

		` + raymarch.replace(/steps/g, 'stepsVert').replace('abs(d)<.5', '(d)<test') +`

		void main() {
			gl_Position = vec4( position.xy, -1., 1.0 );
			vec4 far = (invMatrix * vec4( position.xy, 1.0, 1.0 ));
			vec4 near = (invMatrix * vec4( position.xy, -1.0, 1.0 ));
			vNear = near.xyz / near.w;
			vFar = far.xyz / far.w;

			vec3 dir0 = vFar - cameraPosition, dir = normalize(dir0), dist, point;
			float maxL = length(dir0), maxL2=maxL*maxL, dist2; //test2 = test*test;
			vPoint = raymarch(cameraPosition, dir, maxL, maxL2);
		}`,
		fragmentShader: `
		#define PI 3.14159265359
		#define PI2 6.28318530718
		#define PI_HALF 1.5707963267949
		#define RECIPROCAL_PI 0.31830988618
		#define RECIPROCAL_PI2 0.15915494
		#define LOG2 1.442695
		#define ISFRAG

		uniform sampler2D envMap;
		uniform mat4 invMatrix;

		` + raymarch.replace(/steps/g, 'stepsFrag') +`

		vec3 normal(in vec3 pos, in float maxL2) {
			const float eps = 0.1;

			const vec3 v1 = vec3( eps,-eps,-eps);
			const vec3 v2 = vec3(-eps,-eps, eps);
			const vec3 v3 = vec3(-eps, eps,-eps);
			const vec3 v4 = vec3( eps, eps, eps);

			return normalize( v1*world( pos + v1, 1., maxL2 ) + 
							  v2*world( pos + v2, 1., maxL2 ) + 
							  v3*world( pos + v3, 1., maxL2 ) + 
							  v4*world( pos + v4, 1., maxL2 ) );
		}

		void main() {
			if (vPoint==cameraPosition) discard;
			vec3 dir0 = vFar - vPoint, dir = normalize(dir0), dist, point;
			float intensity = 0., maxL = length(dir0), maxL2=maxL*maxL, dist2; //test2 = test*test;
			point = raymarch(vPoint, dir, maxL, maxL2);
			if (point==cameraPosition) discard;

			vec2 sampleUV;
			vec3 reflectVec = reflect( dir, normal(point, maxL2) );
			sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
			sampleUV.x = asin( reflectVec.z / length(reflectVec.xz) ) * RECIPROCAL_PI2 + 0.5;
			//float val=float(n)/float(stepsFrag);
			gl_FragColor = texture2D( envMap, sampleUV ); //vec4(val,1.0-val,0,1);
			//if (point!=vPoint) gl_FragColor.b=.5;

		}`
			// //for (int i = 0; i < steps; i++) {
			// 	float distInv = 0.;
			// 	//point = mix(vNear, vFar, float(i)/float(steps) );
			// 	for (int j = 0; j < maxBlobs; j++) {
			// 		if (j == numBlobs) break;
			// 		blob = blobs[j] - cameraPosition;
			// 		dist = blob - dir * length(blob);
			// 		dist2 = dot(dist, dist);
			// 		distInv = max(test2 - dist2, 0.)/test2;
			// 		intensity = max(intensity, distInv);
			// 	}
			// 	//if (i > 0 && dist0 < distInv) break;
			// //}

			// gl_FragColor = vec4( 0, 1, 0, intensity );

	});
	var metaBalls = new THREE.Mesh(new THREE.PlaneGeometry(2,2, Math.round(rect.x/10), Math.round(rect.y/10)), material);
	metaBalls.setN = function(n) {
		material.uniforms.numBlobs.value = n;
	};
	metaBalls.onBeforeRender = function(){
		material.uniforms.invMatrix.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
	};
	metaBalls.resize=function(rect){
		metaBalls.geometry = new THREE.PlaneBufferGeometry(2,2, Math.round(rect.x/10), Math.round(rect.y/10))
	}

	return metaBalls
};
