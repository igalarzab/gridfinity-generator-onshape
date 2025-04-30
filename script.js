/**
 *
 * Gridfinity Generator for Onshape
 * ================================
 *
 * Author: Jose Galarza (@igalarzab)
 * <https://x.com/igalarzab>
 * 
 * You can submit bugs and feature requests in:
 * <https://github.com/igalarzab/gridfinity-generator-onshape/>
 * 
 * Gridfinity is an original idea developed by Zach Freedman
 * <https://www.youtube.com/@ZackFreedman>
 *
 * Gridfinity Specifications thanks to @Stu142
 * <https://github.com/Stu142/Gridfinity-Documentation>
 *
 * This work is licensed under Creative Commons Attribution-ShareAlike 4.0
 * <https://creativecommons.org/licenses/by-sa/4.0/>
 *
 */

FeatureScript 2625;

import(path: 'onshape/std/common.fs', version: '2625.0');
import(path: 'onshape/std/geometry.fs', version: '2625.0');


/**
 *
 * Dimensions.
 *
 * You can change any of these dimensions to modify your bin, but doing so will make
 * your part to be not-Gridfinity compliant
 *
 */

const Dims = {
    unitSize: 42 * millimeter,
    unitHeight: 7 * millimeter,
    unitSeparator: 0.25 * millimeter,

    baseFillet: 0.8 * millimeter,
    baseHoleClearance: 4.8 * millimeter,
    baseDraftAngle: 45 * degree,
    baseLayer1Height: 0.8 * millimeter,
    baseLayer2Height: 1.8 * millimeter,
    baseLayer3Height: 2.15 * millimeter,
    baseLayer4Height: 2.25 * millimeter,

    bodyFillet: 3.75 * millimeter,
    bodyInternalFillet: 2.55 * millimeter,
    bodyWallThickness: 1.2 * millimeter,

    topHeight: 4.4 * millimeter,
    topRoundedLipFillet: 0.5 * millimeter,
};


/**
 *
 * Global Variables.
 *
 */

export enum TopLipShape {
    SHARP, ROUNDED
}


export enum FillType {
    COMPLETE, UNTIL_LIP
}


enum FaceType {
    TOP, BOTTOM, LEFT
}


const Planes = {
    top: qCreatedBy(makeId('Top'), EntityType.FACE),
    right: qCreatedBy(makeId('Right'), EntityType.FACE),
    front: qCreatedBy(makeId('Front'), EntityType.FACE),
};


// Ranges -> (min, default, max)
const MAGNETS_RADIUS_RANGE = [0.5, 3.25, 4.25];
const MAGNETS_DEPTH_RANGE = [0.5, 2.4, 4];


// Sweep contour for each lid type (in mm)
const LID_SWEEP = {
    TopLipShape.SHARP: {
        x: [0.0, 4.4,  2.5,  0.7,  0.0,  0.0, -2.6, 0.0],
        y: [0.0, 0.0, -1.9, -1.9, -2.6, -2.6,  0.0, 0.0],
    },
    TopLipShape.ROUNDED: {
        x: [0.0, 4.4,   4.4, 3.05, 1.25, 0.55,  0.0, -2.6, 0.0],
        y: [0.0, 0.0, -0.55, -1.9, -1.9, -2.6, -2.6,  0.0, 0.0],
    }
};


/**
 *
 * Feature Definition
 *
 */

annotation { 'Feature Type Name' : 'Gridfinity Bin', 'Feature Type Description' : 'Create a gridfinity bin' }
export const gridfinityBin = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { 'Group Name' : 'General Bin', 'Collapsed By Default' : false }
        {
            annotation { 'Name' : 'Rows', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.rows, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Columns', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.columns, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Height', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.height, { (unitless) : [2, 6, 100] } as IntegerBoundSpec);
        }

        annotation { 'Group Name' : 'Bin Properties', 'Collapsed By Default' : false }
        {
            annotation { 'Name' : 'Fill the bin' }
            definition.filled is boolean;

            annotation { 'Name' : 'Add Stackable Lip', 'Default': true }
            definition.stackableLip is boolean;

            annotation { 'Name' : 'Add Magnets', 'Default': true }
            definition.magnets is boolean;

            if (!definition.filled) {
                annotation { 'Name' : 'Add Label', 'Default': true }
                definition.label is boolean;

                annotation { 'Name' : 'Add Finger Slide', 'Default': true }
                definition.fingerSlide is boolean;
            }
        }
        
        if (definition.filled) {
            annotation { 'Group Name' : 'Fill Config', 'Collapsed By Default' : true }
            {
                annotation { 'Name' : 'Type', 'Default': FillType.UNTIL_LIP }
                definition.fillType is FillType;
            }
        }

        if (definition.magnets) {
            annotation { 'Group Name' : 'Magnets Config', 'Collapsed By Default' : true }
            {
                annotation { 'Name' : 'Radius' }
                isLength(definition.baseMagnetRadius, { (millimeter): MAGNETS_RADIUS_RANGE } as LengthBoundSpec);

                annotation { 'Name' : 'Depth' }
                isLength(definition.baseMagnetDepth, { (millimeter): MAGNETS_DEPTH_RANGE } as LengthBoundSpec);
            }
        }

        if (definition.stackableLip) {
            annotation { 'Group Name' : 'Stackable Lip Config', 'Collapsed By Default' : true }
            {
                annotation { 'Name' : 'Shape', 'Default': TopLipShape.SHARP }
                definition.lipShape is TopLipShape;
            }
        }

    }
    {
        // Create the 3 parts
        const base = baseCreate(context, definition, id + 'Base');
        const body = bodyCreate(context, definition, id + 'Body', base);
        const top = topCreate(context, definition, id + 'Top', body);
        
        // Merge everything in one part
        mergeParts(context, id + 'Bin', [base.id, body.id, top.id]);

        // Center the bin in the origin
        centerPart(context, id + 'Center', base.id);

        // Rename the bin
        renamePart(context, base.id, 'Gridfinity Bin ' ~ definition.rows ~ 'x' ~ definition.columns);
    }
);


/**
 *
 * Functions to create the base of the bin
 *
 */

function baseCreate(context is Context, definition is map, id is Id) {
    const baseSketch = baseSketch(context, definition, id + 'BaseSketch');

    // Create the 3 layers of the base
    const layer1Extrude = wallExtrude(context, id + 'Layer1', baseSketch.region, {
        depth: Dims.baseLayer1Height,
        filletRadius: Dims.baseFillet,
        draftAngle: Dims.baseDraftAngle,
    });

    const layer2Extrude = wallExtrude(context, id + 'Layer2', findFace(context, layer1Extrude.id, FaceType.TOP), {
        depth: Dims.baseLayer2Height,
    });

    const layer3Extrude = wallExtrude(context, id + 'Layer3', findFace(context, layer2Extrude.id, FaceType.TOP), {
        depth: Dims.baseLayer3Height,
        draftAngle: Dims.baseDraftAngle,
    });

    // Merge the three layers into a single part
    const basePart = mergeParts(context, id + 'BasePart', [
        layer1Extrude.id,
        layer2Extrude.id,
        layer3Extrude.id,
    ]);

    // Create the magnet holes if needed
    if (definition.magnets) {
        const holesSketch = baseMagnetHolesSketch(context, id + 'Magnets', definition, basePart);

        const magnets = wallExtrude(context, id + 'MagnetsExtrude', holesSketch.region, {
            depth: definition.baseMagnetDepth,
        });

        substractParts(context, id + 'MagnetsHole', basePart.id, [magnets.id]);
        removeBodies(context, id + 'DeleteMagnetsSketch', [holesSketch.id]);
    }

    // Replicate the base for rows * columns
    var linearPatternId = undefined;
    if (definition.rows > 1 || definition.columns > 1) {
        linearPatternId = id + 'ReplicateBases';

        linearPattern(context, linearPatternId, {
            'patternType': PatternType.PART,
            'entities': qCreatedBy(basePart.id, EntityType.BODY),
            'hasSecondDir': true,
            'oppositeDirectionTwo': true,
            'directionOne': Planes.right,
            'directionTwo': Planes.front,
            'distance': Dims.unitSize,
            'distanceTwo': Dims.unitSize,
            'instanceCount': definition.rows,
            'instanceCountTwo': definition.columns,
        });
    }

    // Layer 4 is common to all the bases, that's why we do it after the linearPattern
    const layer4Sketch = baseLayer4Sketch(
        context,
        definition,
        id + 'Layer4Sketch',
        layer3Extrude
    );

    const layer4Extrude = wallExtrude(context, id + 'Layer4Extrude', layer4Sketch.region, {
        depth: Dims.baseLayer4Height,
        filletRadius: Dims.bodyFillet,
    });

    // Merge all the bases into a single part
    mergeParts(context, id + 'AllBases', [
        basePart.id,
        linearPatternId,
        layer4Extrude.id,
    ]);

    // Remove sketches, they are not needed anymore
    removeBodies(context, id + 'DeleteBaseSketches', [baseSketch.id, layer4Sketch.id]);

    return { 'id': basePart.id, 'layer4Id': layer4Extrude.id, 'layer3Id': layer3Extrude.id };
}


function baseSketch(context is Context, definition is map, id is Id) {
    const sketchId = id + 'Sketch';

    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : Planes.top,
    });

    const bottomSize = baseCalculateBottomSize();
    const translateX = (bottomSize / 2);
    const translateY = (bottomSize / 2);

    skRectangle(sketch, 'bottomSketchRectangle', {
        'firstCorner': vector(-translateX, -translateY),
        'secondCorner': vector(bottomSize - translateX, bottomSize - translateY)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseMagnetHolesSketch(context is Context, id is Id, definition is map, base is map) {
    const sketchId = id + 'Sketch';

    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : findFace(context, base.id, FaceType.BOTTOM),
    });

    const bottomSize = baseCalculateBottomSize();
    const x = (bottomSize / 2) - Dims.baseHoleClearance;
    const y = -(bottomSize / 2) + Dims.baseHoleClearance;

    skCircle(sketch, 'bottomRight', { 'center' : vector(x, x), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'topRight',    { 'center' : vector(x, y), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'bottomLeft',  { 'center' : vector(y, x), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'topLeft',     { 'center' : vector(y, y), 'radius' : definition.baseMagnetRadius });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseLayer4Sketch(context is Context, definition is map, id is Id, layer3Extrude is map) {
    const sketchId = id + 'Sketch';

    const tangentPlane = evFaceTangentPlane(context, {
        'face': findFace(context, layer3Extrude.id, FaceType.TOP),
        'parameter': vector(0.5, 0.5),
    });

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : tangentPlane
    });

    const totalX = (Dims.unitSize * definition.rows) - (Dims.unitSeparator * 2);
    const totalY = (Dims.unitSize * definition.columns) - (Dims.unitSeparator * 2);

    const bottomSize = baseCalculateBottomSize();
    const translateX = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;
    const translateY = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;

    skRectangle(sketch, 'rectangle', {
        'firstCorner': vector(-translateX, -translateY),
        'secondCorner': vector(totalX - translateX, totalY - translateY)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseCalculateBottomSize() {
    return Dims.unitSize - ((Dims.baseLayer1Height + Dims.baseLayer3Height + Dims.unitSeparator) * 2);
}


/**
 *
 * Functions to create the body of the bin
 *
 */

function bodyCreate(context is Context, definition is map, id is Id, base is map) {
    const topFace = findFace(context, base.layer4Id, FaceType.TOP);

    const bodyExtrude = wallExtrude(context, id + 'Body', topFace, {
        depth: Dims.unitHeight * (definition.height - 1),
    });

    if (!definition.filled) {
        const sketch = bodyHollowSketch(context, definition, id + 'Body', base);
        
        const hollowExtrude = wallExtrude(context, id + 'Hollow', sketch.region, {
            depth: Dims.unitHeight * (definition.height - 1),
            filletRadius: Dims.bodyInternalFillet,
        });
        
        substractParts(context, id, bodyExtrude.id, [hollowExtrude.id]);
        removeBodies(context, id + 'DeleteBodyHollowSketch', [sketch.id]);
    }
    
    return { 'id': bodyExtrude.id };
}


function bodyHollowSketch(context is Context, definition is map, id is Id, base is map) {
    const sketchId = id + 'Sketch';

    const tangentPlane = evFaceTangentPlane(context, {
        'face': findFace(context, base.layer4Id, FaceType.TOP),
        'parameter': vector(0.5, 0.5),
    });

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : tangentPlane
    });

    const totalX = (Dims.unitSize * definition.rows) - (Dims.unitSeparator * 2);
    const totalY = (Dims.unitSize * definition.columns) - (Dims.unitSeparator * 2);

    const bottomSize = baseCalculateBottomSize();
    const translateX = ((Dims.unitSize / 2) * definition.rows) - Dims.unitSeparator;
    const translateY = ((Dims.unitSize / 2) * definition.columns) - Dims.unitSeparator;
    
    const offset = Dims.bodyWallThickness;

    skRectangle(sketch, 'rectangle', {
        'firstCorner': vector(offset - translateX, offset - translateY),
        'secondCorner': vector(totalX - translateX - offset, totalY - translateY - offset)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


/**
 *
 * Functions to create the top of the bin
 *
 */

function topCreate(context is Context, definition is map, id is Id, body is map) {
    const topFace = findFace(context, body.id, FaceType.TOP);
    const topId = id + 'Top';

    // If the bin should be filled completely we extrude the whole top    
    if (definition.filled && definition.fillType == FillType.COMPLETE) {        
        wallExtrude(context, topId, topFace, {
            'depth': Dims.topHeight,
        });
        
        return { 'id': topId };
    }

    // Otherwise we prepare the sweep to create the lid
    const lipSketch = topLipSketch(context, definition, id + 'Lip', body);
    const bodyLoops = qIntersection(qCreatedBy(body.id, EntityType.EDGE), qLoopEdges(topFace));
        
    opSweep(context, topId, {
        'profiles': lipSketch.region,
        'path': bodyLoops,
    });
    
        
    // The rounded shape needs some fillets
    if (definition.lipShape == TopLipShape.ROUNDED) {
        const topLoops = qLoopEdges(findFace(context, topId, FaceType.TOP));
        const leftFaceLoops = qLoopEdges(findFace(context, topId, FaceType.LEFT));
        const topEdge = qIntersection(topLoops, leftFaceLoops);
        
        opFillet(context, id + 'TopFillet', {
           'entities': topEdge,
            'radius' : Dims.topRoundedLipFillet,
            'tangentPropagation': true,
        });
    }

    removeBodies(context, id + 'DeleteLipSketch', [lipSketch.id]);

    return { 'id': topId };
}


function topLipSketch(context is Context, definition is map, id is Id, top is map) {
    const sketchId = id + 'Sketch';

    const tangentPlane = evFaceTangentPlane(context, {
        'face': findFace(context, top.id, FaceType.TOP),
        'parameter': vector(0.5, 0)
    });

    const perpendicularPlane = plane(
        tangentPlane.origin,
        tangentPlane.x,
        tangentPlane.normal
    );

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : perpendicularPlane
    });
    
    const x = LID_SWEEP[definition.lipShape]['x'];
    const y = LID_SWEEP[definition.lipShape]['y'];

    for (var i = 0; i != size(x)-1; i += 1) {
        skLineSegment(sketch, 'Line' ~ i, {
            'start' : vector(x[i], y[i]) * millimeter,
            'end' : vector(x[i+1], y[i+1]) * millimeter
        });
    }

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


/**
 *
 * Helper functions
 *
 */

 function wallExtrude(context is Context, id is Id, face is Query, config is map) {
    const extrudeId = id + 'Extrude';

    opExtrude(context, extrudeId, {
        'entities' : face,
        'direction' : evPlane(context, {'face' : Planes.top}).normal,
        'endBound' : BoundingType.BLIND,
        'endDepth' : config.depth
    });

    if (config.filletRadius != undefined) {
        const edges = qParallelEdges(
            qCreatedBy(id, EntityType.EDGE),
            evPlane(context, {'face' : Planes.top}).normal
        );

        opFillet(context, id + 'Fillet', {
            'entities' : edges,
            'radius' : config.filletRadius
        });
    }

    if (config.draftAngle != undefined) {
        const rightFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.right})
        );

        const frontFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.front})
        );

        opDraft(context, id + 'Draft', {
            'draftType' : DraftType.REFERENCE_SURFACE,
            'draftFaces' : qUnion(rightFaces, frontFaces),
            'referenceSurface': face,
            'pullVec' : vector(0, 0, -1),
            'angle' : config.draftAngle
        });
    }

    return { 'id': extrudeId };
}


function mergeParts(context is Context, id is Id, partIds is array) {
    var parts = [];
    var firstPartId = undefined;

    for (var partId in partIds) {
        if (partId != undefined) {
            parts = append(parts, qCreatedBy(partId, EntityType.BODY));

            if (firstPartId == undefined) {
                firstPartId = partId;
            }
        }
    }

    opBoolean(context, id + 'Union', {
        operationType: BooleanOperationType.UNION,
        tools: qUnion(parts)
    });

    // In an union, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
}


function substractParts(context is Context, id is Id, targetId is Id, partIds is array) {
    var parts = [];
    var firstPartId = undefined;

    for (var partId in partIds) {
        if (partId != undefined) {
            parts = append(parts, qCreatedBy(partId, EntityType.BODY));

            if (firstPartId == undefined) {
                firstPartId = partId;
            }
        }
    }

    opBoolean(context, id + 'Substract', {
        operationType: BooleanOperationType.SUBTRACTION,
        targets: qCreatedBy(targetId, EntityType.BODY),
        tools: qUnion(parts)
    });

    // In a removal, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
}


function findFace(context is Context, id is Id, face is FaceType) {
    const allFaces = evaluateQuery(context, qCreatedBy(id, EntityType.FACE));
    var vectorValue = undefined;
    
    if (face == FaceType.TOP) {
        vectorValue = vector(0, 0, 1);
    } else if (face == FaceType.BOTTOM) {
        vectorValue = vector(0, 0, -1);
    } else if (face == FaceType.LEFT) {
        vectorValue = vector(-1, 0, 0);
    } else {
        throw 'Invalid FaceType value: ' ~ face;
    }

    for (var f in allFaces) {
        const plane = evFaceTangentPlane(context, { 'face': f, parameter: vector(0.5, 0.5) });

        if (plane.normal == vectorValue) {
            return f;
        }
    }

    debug(context, 'No ' ~ face ~ ' face found for ' ~ id, DebugColor.RED);
    debug(context, allFaces);

    return undefined;
}


function removeBodies(context is Context, id is Id, idsToRemove is array) {
    var finalIds = [];

    for (var idToRemove in idsToRemove) {
        if (idToRemove != undefined) {
            finalIds = append(finalIds, qCreatedBy(idToRemove, EntityType.BODY));
        }
    }

    opDeleteBodies(context, id + 'DeleteBodies', {
        entities: qUnion(finalIds)
    });
}


function centerPart(context is Context, id is Id, partId is Id) {
    const part = qCreatedBy(partId, EntityType.BODY);

    const boxPart = evBox3d(context, {
        'topology': qCreatedBy(partId, EntityType.BODY)
    });

    var center = 0.5 * (boxPart.minCorner + boxPart.maxCorner);
    center[2] = 0 * millimeter;

    opTransform(context, id + 'MoveToOrigin', {
        'bodies': part,
        'transform': transform(-center)
    });
}


function renamePart(context is Context, id is Id, name is string) {
    setProperty(context, {
        'entities' : qCreatedBy(id, EntityType.BODY),
        'propertyType' : PropertyType.NAME,
        'value' : name
    });
}