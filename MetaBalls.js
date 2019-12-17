THREE.MetaBalls = function(envMap, camera, blobs, maxBlobs) {
	var material = new THREE.ShaderMaterial({
		transparent: true,
		defines: {
			maxBlobs: maxBlobs
		},
		uniforms: {
			envMap: {value: envMap},
			blobs: {value: blobs[0]},
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
		varying vec3 vNear, vFar; //
		vec3 point;
		bool breakAll;

		float world(in vec3 at, in float maxL) {
			float sum = 0., minR = maxL*maxL;
			for (int i = 0; i < maxBlobs; ++i) {
				if (i==numBlobs) break;
				vec3 r = (blobs[i] - at);
				float r2 = dot(r, r);
				minR = min(r2, minR);
				sum += test/r2;
				//sum = min(sum, length(r) - test);
			}
			return (1. - sum)*sqrt(minR);
		}

		vec3 normal(in vec3 pos) {
			const float eps = 0.1;

			const vec3 v1 = vec3( 1.0,-1.0,-1.0);
			const vec3 v2 = vec3(-1.0,-1.0, 1.0);
			const vec3 v3 = vec3(-1.0, 1.0,-1.0);
			const vec3 v4 = vec3( 1.0, 1.0, 1.0);

			return normalize( v1*world( pos + v1*eps, 1. ) + 
							  v2*world( pos + v2*eps, 1. ) + 
							  v3*world( pos + v3*eps, 1. ) + 
							  v4*world( pos + v4*eps, 1. ) );
		}

		vec3 raymarch(in vec3 pos, in vec3 dir, in float maxL) {
			float l = 0.;
			for (int i = 0; i < 128; ++i) {
				float d = world(pos + dir * l, maxL);
				l += d; //d<0. ? d/=2. : d;
				if ( abs(d)<.1 || i==steps) break;
				if (l > maxL) {l = 0.; break;}
			}
			return vec3(pos + dir * l);
		}

		void main() {
			vec3 dir0 = vFar - cameraPosition, dir = normalize(dir0), dist, point;
			float intensity = 0., maxL = length(dir0), dist2; //test2 = test*test;
			gl_FragColor = vec4(0, 1, 0, 1);
			point = raymarch(cameraPosition, dir, maxL);
			if (point==cameraPosition) discard;

			vec2 sampleUV;
			vec3 reflectVec = reflect( dir, normal(point) );
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
