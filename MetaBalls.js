THREE.MetaBalls = function(envMap, camera, blobs, maxBlobs) {
	var material = new THREE.ShaderMaterial({
		transparent: true,
		defines: {
			maxBlobs: maxBlobs
		},
		uniforms: {
			envMap: {value: envMap},
			blobs: {value: blobs[0]},
			weights: {value: blobs[1]},
			numBlobs: {type: '1i', value: maxBlobs},
			invMatrix: {value: new THREE.Matrix4()},
			steps: {value: 100},
			test: {value: 8800}
		},
		vertexShader: `
		uniform mat4 invMatrix;
		varying vec3 vNear, vFar; //
		void main() {
			gl_Position = vec4( position.xy, -1., 1.0 );
			vec4 far = (invMatrix * vec4( position.xy, 1.0, 1.0 ));
			vec4 near = (invMatrix * vec4( position.xy, -1.0, 1.0 ));
			vNear = near.xyz / far.w;
			vFar = far.xyz / far.w;
		}`,
		fragmentShader: `
		#define PI 3.14159265359
		#define PI2 6.28318530718
		#define PI_HALF 1.5707963267949
		#define RECIPROCAL_PI 0.31830988618
		#define RECIPROCAL_PI2 0.15915494
		#define LOG2 1.442695

		uniform sampler2D envMap;
		uniform mat4 invMatrix;
		uniform vec3 blobs[maxBlobs];
		uniform int numBlobs, steps;
		uniform float test;
		uniform float weights[maxBlobs];
		varying vec3 vNear, vFar; //
		vec3 point;
		bool breakAll;

		float world(in vec3 at, in float maxL, in float maxL2) {
			float sum = 0., invR = 0.;
			for (int i = 0; i < maxBlobs; ++i) {
				if (i==numBlobs) break;
				vec3 r = (blobs[i] - at);
				float r2 = inversesqrt(dot(r, r));
				invR += r2;
				sum += weights[i]*r2;
				//sum = min(sum, length(r) - test);
			}
			return (1. - sum)/invR*float(numBlobs);
		}

		vec3 normal(in vec3 pos, in float maxL2) {
			const float eps = 0.1;

			const vec3 v1 = vec3( 1.0,-1.0,-1.0);
			const vec3 v2 = vec3(-1.0,-1.0, 1.0);
			const vec3 v3 = vec3(-1.0, 1.0,-1.0);
			const vec3 v4 = vec3( 1.0, 1.0, 1.0);

			return normalize( v1*world( pos + v1*eps, 1., maxL2 ) + 
							  v2*world( pos + v2*eps, 1., maxL2 ) + 
							  v3*world( pos + v3*eps, 1., maxL2 ) + 
							  v4*world( pos + v4*eps, 1., maxL2 ) );
		}

		vec3 raymarch(in vec3 pos, in vec3 dir, in float maxL, in float maxL2) {
			float l = 0.;
			for (int i = 0; i < 64; ++i) {
				float d = world(pos + dir * l, maxL, maxL2);
				l += d; //d<0. ? d/=2. : d;
				if ( abs(d)<.3 || i==steps) break;
				if (l > maxL) {l = 0.; break;}
			}
			return vec3(pos + dir * l);
		}

		void main() {
			vec3 dir0 = vFar - cameraPosition, dir = normalize(dir0), dist, point;
			float intensity = 0., maxL = length(dir0), maxL2=maxL*maxL, dist2; //test2 = test*test;
			gl_FragColor = vec4(0, 1, 0, 1);
			point = raymarch(cameraPosition, dir, maxL, maxL2);
			if (point==cameraPosition) discard;

			vec2 sampleUV;
			vec3 reflectVec = reflect( dir, normal(point, maxL2) );
			sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
			sampleUV.x = asin( reflectVec.z / length(reflectVec.xz) ) * RECIPROCAL_PI2 + 0.5;
			gl_FragColor = texture2D( envMap, sampleUV );

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
	var metaBalls = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
	metaBalls.setN = function(n) {
		material.uniforms.numBlobs.value = n;
	};
	metaBalls.onBeforeRender = function(){
		material.uniforms.invMatrix.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
		debugger;
	};

	return metaBalls
};
